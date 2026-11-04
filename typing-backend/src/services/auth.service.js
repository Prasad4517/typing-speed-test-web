import { randomUUID } from 'node:crypto';

import {
  AUTH,
  TOKEN_STATUSES,
  USER_ROLES,
  USER_STATUSES,
} from '../constants/auth.js';
import { LIMITS } from '../constants/limits.js';
import { MESSAGES } from '../constants/messages.js';
import {
  AccountLockedError,
  AccountUnavailableError,
  ConflictError,
  EmailNotVerifiedError,
  ForbiddenError,
  InvalidCredentialsError,
  InvalidCsrfError,
  InvalidPasswordResetTokenError,
  InvalidSessionError,
  InvalidVerificationTokenError,
  NotFoundError,
  RefreshReuseDetectedError,
  UnauthorizedError,
  ValidationError,
} from '../utils/app-error.js';
import { createOpaqueToken, hashOpaqueToken } from './token.service.js';

function rolesOf(user) {
  return (user.roleAssignments || [])
    .map((assignment) => assignment.roleName)
    .sort();
}

function serializeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    status: user.status,
    roles: rolesOf(user),
    createdAt: user.createdAt?.toISOString?.() || null,
  };
}

function serializeSession(session, currentSessionId) {
  return {
    id: session.id,
    deviceLabel: session.deviceLabel,
    createdAt: session.createdAt?.toISOString?.() || null,
    lastActivityAt: session.lastActivityAt?.toISOString?.() || null,
    expiresAt: session.expiresAt?.toISOString?.() || null,
    revokedAt: session.revokedAt?.toISOString?.() || null,
    current: session.id === currentSessionId,
  };
}

function addMilliseconds(date, milliseconds) {
  return new Date(date.getTime() + milliseconds);
}

function sameRoles(left, right) {
  return (
    left.length === right.length &&
    [...left].sort().every((role, index) => role === [...right].sort()[index])
  );
}

function isPrismaUniqueConflict(error) {
  return error?.code === 'P2002';
}

export function createAuthService({
  repository,
  config,
  accessTokenService,
  passwordService,
  csrfService,
  outboxCrypto,
  rateLimiter,
  now = () => new Date(),
}) {
  function makeAudit(eventType, metadata, extra = {}) {
    return {
      eventType,
      requestId: metadata?.requestId || null,
      ipAddress: metadata?.ipAddress || null,
      userAgent: metadata?.userAgent || null,
      outcome: extra.outcome || 'SUCCESS',
      userId: extra.userId || null,
      sessionId: extra.sessionId || null,
      metadata: extra.metadata,
    };
  }

  function makeEncryptedOutbox({
    kind,
    user,
    token,
    expiresAt,
    now: createdAt,
  }) {
    const encrypted = outboxCrypto.encrypt(
      JSON.stringify({ token, expiresAt: expiresAt.toISOString() }),
    );
    return {
      kind,
      recipient: user.email,
      payload: {
        version: 1,
        encrypted,
        user: { id: user.id, fullName: user.fullName },
      },
      availableAt: createdAt,
    };
  }

  function verificationMaterial(user, requestedAt) {
    const rawToken = createOpaqueToken(AUTH.verificationTokenBytes);
    const expiresAt = addMilliseconds(
      requestedAt,
      config.emailVerificationTtlMinutes * 60 * 1000,
    );
    return {
      rawToken,
      token: { tokenHash: hashOpaqueToken(rawToken), expiresAt },
      outbox: makeEncryptedOutbox({
        kind: 'VERIFY_EMAIL',
        user,
        token: rawToken,
        expiresAt,
        now: requestedAt,
      }),
    };
  }

  function resetMaterial(user, requestedAt) {
    const rawToken = createOpaqueToken(AUTH.passwordResetTokenBytes);
    const expiresAt = addMilliseconds(
      requestedAt,
      config.passwordResetTtlMinutes * 60 * 1000,
    );
    return {
      rawToken,
      token: { tokenHash: hashOpaqueToken(rawToken), expiresAt },
      outbox: makeEncryptedOutbox({
        kind: 'RESET_PASSWORD',
        user,
        token: rawToken,
        expiresAt,
        now: requestedAt,
      }),
    };
  }

  function securityNotification(user, kind, createdAt) {
    return {
      kind,
      recipient: user.email,
      payload: {
        version: 1,
        user: { id: user.id, fullName: user.fullName },
        occurredAt: createdAt.toISOString(),
      },
      availableAt: createdAt,
    };
  }

  function requireCsrfSession(csrf, sessionId) {
    if (csrf?.sid !== sessionId)
      throw new InvalidCsrfError(MESSAGES.invalidCsrf);
  }

  async function authenticationResponse({ user, session, refreshToken }) {
    const roles = rolesOf(user);
    const [accessToken, csrfToken] = await Promise.all([
      accessTokenService.issue({
        userId: user.id,
        sessionId: session.id,
        roles,
        securityVersion: user.securityVersion,
      }),
      Promise.resolve(csrfService.issue(session.id)),
    ]);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.accessTokenTtlSeconds,
      user: serializeUser(user),
      session: serializeSession(session, session.id),
      csrfToken,
      refreshToken,
    };
  }

  return Object.freeze({
    async checkRateLimit({ action, metadata, identifier = '' }) {
      const limits = {
        signup: LIMITS.authSignUpRateLimit,
        signin: LIMITS.authLoginRateLimit,
        refresh: LIMITS.authRefreshRateLimit,
        verify: LIMITS.authVerifyRateLimit,
        resend: LIMITS.authVerifyRateLimit,
        forgot: LIMITS.authPasswordResetRateLimit,
        reset: LIMITS.authPasswordResetRateLimit,
        account: LIMITS.accountMutationRateLimit,
      };
      await rateLimiter.check({
        action,
        ipAddress: metadata.ipAddress,
        identifier,
        limit: limits[action] || LIMITS.accountMutationRateLimit,
        windowMs: 60_000,
      });
    },

    async createCsrfToken({ refreshToken }) {
      let sessionId = 'pre-auth';
      if (refreshToken) {
        const context = await repository.findRefreshSessionByHash(
          hashOpaqueToken(refreshToken),
          now(),
        );
        if (context) sessionId = context.sessionId;
      }
      const csrfToken = csrfService.issue(sessionId);
      return { csrfToken };
    },

    async signUp({ fullName, email, password, metadata }) {
      passwordService.validate(password);
      if (await repository.findUserByEmail(email)) {
        throw new ConflictError(MESSAGES.emailAlreadyRegistered);
      }
      const requestedAt = now();
      const userId = randomUUID();
      const candidateUser = { id: userId, email, fullName };
      const verification = verificationMaterial(candidateUser, requestedAt);
      try {
        const user = await repository.createPendingUser({
          user: {
            id: userId,
            email,
            normalizedEmail: email,
            fullName,
            passwordHash: await passwordService.hash(password),
            status: USER_STATUSES.pending,
            credentialsChangedAt: requestedAt,
          },
          roleName: USER_ROLES.user,
          verificationToken: verification.token,
          outbox: verification.outbox,
          audit: makeAudit('SIGNUP_SUCCESS', metadata),
        });
        return {
          user: serializeUser(user),
          message:
            'Account created. Check your email for a verification token.',
        };
      } catch (error) {
        if (isPrismaUniqueConflict(error)) {
          throw new ConflictError(MESSAGES.emailAlreadyRegistered);
        }
        throw error;
      }
    },

    async verifyEmail({ token, metadata }) {
      const result = await repository.verifyEmail({
        tokenHash: hashOpaqueToken(token),
        now: now(),
        audit: makeAudit('EMAIL_VERIFIED', metadata),
      });
      if (result.kind === 'invalid') {
        throw new InvalidVerificationTokenError(MESSAGES.invalidVerification);
      }
      return {
        user: serializeUser(result.user),
        message:
          result.kind === 'already_verified'
            ? 'Email is already verified.'
            : 'Email verified. You can now sign in.',
      };
    },

    async resendVerification({ email, metadata }) {
      const user = await repository.findUserByEmail(email);
      if (user?.status === USER_STATUSES.pending) {
        const requestedAt = now();
        const verification = verificationMaterial(user, requestedAt);
        await repository.replaceVerificationToken({
          userId: user.id,
          token: verification.token,
          outbox: verification.outbox,
          now: requestedAt,
          audit: makeAudit('VERIFICATION_REQUESTED', metadata),
        });
      }
      return { message: MESSAGES.verificationRequested };
    },

    async signIn({ email, password, deviceLabel, metadata }) {
      let user = await repository.findUserByEmail(email);
      if (!user) {
        await passwordService.verifyDummy(password);
        await repository.createAudit(
          makeAudit('SIGNIN_FAILURE', metadata, { outcome: 'FAILURE' }),
        );
        throw new InvalidCredentialsError(MESSAGES.invalidCredentials);
      }

      const requestedAt = now();
      if (
        user.status === USER_STATUSES.locked &&
        user.lockedUntil &&
        user.lockedUntil <= requestedAt
      ) {
        user = await repository.unlockExpiredAccount({
          userId: user.id,
          now: requestedAt,
        });
      }

      if (
        user.status === USER_STATUSES.locked &&
        user.lockedUntil > requestedAt
      ) {
        const lockedPasswordValid = await passwordService.verify(
          user.passwordHash,
          password,
        );
        if (!lockedPasswordValid) {
          throw new InvalidCredentialsError(MESSAGES.invalidCredentials);
        }
        throw new AccountLockedError(MESSAGES.accountLocked);
      }

      const passwordValid = await passwordService.verify(
        user.passwordHash,
        password,
      );
      if (!passwordValid) {
        await repository.recordSigninFailure({
          userId: user.id,
          now: requestedAt,
          lockoutThreshold: config.lockoutThreshold,
          lockedUntil: addMilliseconds(
            requestedAt,
            config.lockoutSeconds * 1000,
          ),
          audit: makeAudit('SIGNIN_FAILURE', metadata, {
            outcome: 'FAILURE',
          }),
        });
        throw new InvalidCredentialsError(MESSAGES.invalidCredentials);
      }

      if (user.status === USER_STATUSES.pending) {
        throw new EmailNotVerifiedError(MESSAGES.emailNotVerified);
      }
      if (user.status !== USER_STATUSES.active) {
        throw new AccountUnavailableError(MESSAGES.accountUnavailable);
      }

      const rawRefreshToken = createOpaqueToken(AUTH.refreshTokenBytes);
      const expiresAt = addMilliseconds(
        requestedAt,
        config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      );
      const session = {
        id: randomUUID(),
        familyId: randomUUID(),
        expiresAt,
        lastActivityAt: requestedAt,
        deviceLabel: deviceLabel || null,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      };
      const created = await repository.createSession({
        userId: user.id,
        session,
        refreshToken: {
          id: randomUUID(),
          tokenHash: hashOpaqueToken(rawRefreshToken),
          expiresAt,
          status: TOKEN_STATUSES.active,
        },
        now: requestedAt,
        audit: makeAudit('SIGNIN_SUCCESS', metadata),
      });
      if (!created)
        throw new AccountUnavailableError(MESSAGES.accountUnavailable);
      return authenticationResponse({
        ...created,
        refreshToken: rawRefreshToken,
      });
    },

    async refresh({ refreshToken, csrf, metadata }) {
      if (!refreshToken) throw new InvalidSessionError(MESSAGES.invalidSession);
      if (!csrf?.sid || csrf.sid === 'pre-auth') {
        throw new InvalidCsrfError(MESSAGES.invalidCsrf);
      }
      const requestedAt = now();
      const rawReplacement = createOpaqueToken(AUTH.refreshTokenBytes);
      const result = await repository.rotateRefreshToken({
        tokenHash: hashOpaqueToken(refreshToken),
        expectedSessionId: csrf.sid,
        replacement: {
          id: randomUUID(),
          tokenHash: hashOpaqueToken(rawReplacement),
          expiresAt: addMilliseconds(
            requestedAt,
            config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
          ),
          status: TOKEN_STATUSES.active,
        },
        now: requestedAt,
        metadata,
        audit: makeAudit('TOKEN_REFRESH_SUCCESS', metadata),
      });
      if (result.kind === 'csrf_mismatch') {
        throw new InvalidCsrfError(MESSAGES.invalidCsrf);
      }
      if (result.kind === 'reused') {
        throw new RefreshReuseDetectedError(MESSAGES.refreshReuse);
      }
      if (result.kind !== 'rotated') {
        throw new InvalidSessionError(MESSAGES.invalidSession);
      }
      return authenticationResponse({
        user: result.user,
        session: result.session,
        refreshToken: rawReplacement,
      });
    },

    async authenticateAccessToken(authorization) {
      const match = /^Bearer ([^\s]+)$/.exec(authorization || '');
      if (!match) throw new UnauthorizedError(MESSAGES.unauthorized);
      const claims = await accessTokenService.verify(match[1]);
      const state = await repository.getAuthorizationState({
        userId: claims.sub,
        sessionId: claims.sid,
      });
      const currentTime = now();
      if (
        !state ||
        state.user.status !== USER_STATUSES.active ||
        state.user.securityVersion !== claims.sv ||
        state.session.revokedAt ||
        state.session.expiresAt <= currentTime
      ) {
        throw new UnauthorizedError(MESSAGES.unauthorized);
      }
      const roles = rolesOf(state.user);
      if (!sameRoles(roles, claims.roles)) {
        throw new UnauthorizedError(MESSAGES.unauthorized);
      }
      return {
        userId: state.user.id,
        sessionId: state.session.id,
        roles,
        user: state.user,
      };
    },

    async logout({ refreshToken, csrf, metadata }) {
      if (!refreshToken) return { message: 'Signed out.' };
      const tokenHash = hashOpaqueToken(refreshToken);
      const context = await repository.findRefreshTokenContext(tokenHash);
      if (context) {
        requireCsrfSession(csrf, context.sessionId);
        await repository.revokeSessionByRefreshHash({
          tokenHash,
          now: now(),
          reason: AUTH.sessionRevocationReasons.logout,
          audit: makeAudit('LOGOUT', metadata),
        });
      }
      return { message: 'Signed out.' };
    },

    async logoutAll({ auth, csrf, metadata }) {
      requireCsrfSession(csrf, auth.sessionId);
      await repository.revokeAllSessions({
        userId: auth.userId,
        now: now(),
        reason: AUTH.sessionRevocationReasons.logoutAll,
        audit: makeAudit('LOGOUT_ALL', metadata),
      });
      return { message: 'Signed out from all devices.' };
    },

    async getCurrentUser({ userId }) {
      const user = await repository.findUserById(userId);
      if (!user || user.status !== USER_STATUSES.active) {
        throw new UnauthorizedError(MESSAGES.unauthorized);
      }
      return serializeUser(user);
    },

    async updateProfile({ auth, csrf, fullName }) {
      requireCsrfSession(csrf, auth.sessionId);
      const user = await repository.updateUserProfile({
        userId: auth.userId,
        fullName,
      });
      if (!user) throw new UnauthorizedError(MESSAGES.unauthorized);
      return serializeUser(user);
    },

    async requestPasswordReset({ email, metadata }) {
      const user = await repository.findUserByEmail(email);
      if (
        user &&
        [USER_STATUSES.active, USER_STATUSES.locked].includes(user.status)
      ) {
        const requestedAt = now();
        const reset = resetMaterial(user, requestedAt);
        await repository.issuePasswordResetToken({
          userId: user.id,
          token: reset.token,
          outbox: reset.outbox,
          now: requestedAt,
          audit: makeAudit('PASSWORD_RESET_REQUESTED', metadata),
        });
      }
      return { message: MESSAGES.passwordResetRequested };
    },

    async resetPassword({ token, newPassword, metadata }) {
      passwordService.validate(newPassword);
      const requestedAt = now();
      const candidate = await repository.resetPassword({
        tokenHash: hashOpaqueToken(token),
        passwordHash: await passwordService.hash(newPassword),
        now: requestedAt,
        audit: makeAudit('PASSWORD_RESET_COMPLETED', metadata),
        outbox: {
          kind: 'PASSWORD_RESET_COMPLETED',
          payload: { version: 1, occurredAt: requestedAt.toISOString() },
          availableAt: requestedAt,
        },
      });
      if (!candidate) {
        throw new InvalidPasswordResetTokenError(MESSAGES.invalidPasswordReset);
      }
      return { message: 'Password reset. Sign in again on every device.' };
    },

    async changePassword({
      auth,
      csrf,
      currentPassword,
      newPassword,
      metadata,
    }) {
      requireCsrfSession(csrf, auth.sessionId);
      passwordService.validate(newPassword);
      const user = await repository.findUserById(auth.userId);
      if (
        !user ||
        !(await passwordService.verify(user.passwordHash, currentPassword))
      ) {
        throw new InvalidCredentialsError(MESSAGES.invalidCredentials);
      }
      if (await passwordService.verify(user.passwordHash, newPassword)) {
        throw new ValidationError('The new password must be different.');
      }
      const requestedAt = now();
      const updated = await repository.changePassword({
        userId: user.id,
        expectedVersion: user.version,
        passwordHash: await passwordService.hash(newPassword),
        now: requestedAt,
        audit: makeAudit('PASSWORD_CHANGED', metadata),
        outbox: securityNotification(user, 'PASSWORD_CHANGED', requestedAt),
      });
      if (!updated)
        throw new ConflictError('Account security state changed. Retry.');
      return { message: 'Password changed. Sign in again on every device.' };
    },

    async listSessions({ auth, limit, cursor }) {
      const sessions = await repository.listSessions({
        userId: auth.userId,
        limit,
        cursor,
        now: now(),
      });
      const hasMore = sessions.length > limit;
      const entries = sessions.slice(0, limit);
      return {
        sessions: entries.map((session) =>
          serializeSession(session, auth.sessionId),
        ),
        nextCursor: hasMore ? entries.at(-1).id : null,
      };
    },

    async revokeSession({ auth, csrf, sessionId, metadata }) {
      requireCsrfSession(csrf, auth.sessionId);
      const revoked = await repository.revokeOwnedSession({
        userId: auth.userId,
        sessionId,
        now: now(),
        audit: makeAudit('SESSION_REVOKED', metadata),
      });
      if (!revoked) throw new NotFoundError('Session not found.');
      return {
        message: 'Session revoked.',
        revokedCurrentSession: sessionId === auth.sessionId,
      };
    },

    userDashboard({ auth }) {
      return {
        message: 'User dashboard access granted.',
        user: serializeUser(auth.user),
      };
    },

    adminDashboard({ auth }) {
      if (!auth.roles.includes(USER_ROLES.admin)) {
        throw new ForbiddenError('Administrator access is required.');
      }
      return {
        message: 'Administrator dashboard access granted.',
        user: serializeUser(auth.user),
      };
    },
  });
}
