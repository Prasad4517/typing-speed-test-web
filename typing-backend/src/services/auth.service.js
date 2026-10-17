import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';

import { AUTH } from '../constants/auth.js';
import { MESSAGES } from '../constants/messages.js';
import { ConflictError, UnauthorizedError } from '../utils/app-error.js';

function hashOpaqueToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createOpaqueToken(byteLength) {
  return randomBytes(byteLength).toString('base64url');
}

function serializeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() || null,
    createdAt: user.createdAt?.toISOString?.() || null,
  };
}

const passwordOptions = Object.freeze({
  type: argon2.argon2id,
  ...AUTH.passwordHashing,
});

const dummyPasswordHash = argon2.hash(
  'not-a-valid-user-password-for-keystroke',
  passwordOptions,
);

async function hashPassword(password) {
  return argon2.hash(password, passwordOptions);
}

export function createAuthService({
  repository,
  config,
  now = () => new Date(),
  sendPasswordReset,
}) {
  const signingKey = new TextEncoder().encode(config.jwtAccessSecret);

  async function issueAccessToken(user) {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: AUTH.accessTokenAlgorithm })
      .setSubject(user.id)
      .setIssuer(config.jwtIssuer)
      .setAudience(config.jwtAudience)
      .setIssuedAt()
      .setExpirationTime(`${config.accessTokenTtlSeconds}s`)
      .sign(signingKey);
  }

  async function issueSession({ user, metadata, familyId = randomUUID() }) {
    const rawRefreshToken = createOpaqueToken(AUTH.refreshTokenBytes);
    const createdAt = now();
    const expiresAt = new Date(
      createdAt.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
    const refreshToken = {
      id: randomUUID(),
      familyId,
      userId: user.id,
      tokenHash: hashOpaqueToken(rawRefreshToken),
      expiresAt,
      userAgent: metadata?.userAgent || null,
      ipAddress: metadata?.ipAddress || null,
    };

    return {
      refreshToken,
      tokens: {
        accessToken: await issueAccessToken(user),
        refreshToken: rawRefreshToken,
      },
    };
  }

  return Object.freeze({
    async signUp({ fullName, email, password, metadata }) {
      const existingUser = await repository.findUserByEmail(email);
      if (existingUser)
        throw new ConflictError(MESSAGES.emailAlreadyRegistered);

      const user = await repository.createUser({
        fullName,
        email,
        passwordHash: await hashPassword(password),
      });
      const session = await issueSession({ user, metadata });
      await repository.createRefreshToken(session.refreshToken);

      return { user: serializeUser(user), tokens: session.tokens };
    },

    async login({ email, password, metadata }) {
      const user = await repository.findUserByEmail(email);
      const passwordHash = user?.passwordHash || (await dummyPasswordHash);
      const isValid = await argon2.verify(passwordHash, password);

      if (!user || !isValid)
        throw new UnauthorizedError(MESSAGES.invalidCredentials);

      const session = await issueSession({ user, metadata });
      await repository.createRefreshToken(session.refreshToken);

      return { user: serializeUser(user), tokens: session.tokens };
    },

    async refresh({ refreshToken, metadata }) {
      if (!refreshToken) throw new UnauthorizedError(MESSAGES.invalidSession);

      const tokenHash = hashOpaqueToken(refreshToken);
      const storedToken = await repository.findRefreshTokenByHash(tokenHash);
      const requestedAt = now();

      if (
        !storedToken ||
        storedToken.revokedAt ||
        storedToken.expiresAt <= requestedAt
      ) {
        if (storedToken) {
          await repository.revokeRefreshTokenFamily({
            familyId: storedToken.familyId,
            revokedAt: requestedAt,
          });
        }
        throw new UnauthorizedError(MESSAGES.invalidSession);
      }

      const replacement = await issueSession({
        user: storedToken.user,
        metadata,
        familyId: storedToken.familyId,
      });
      const rotated = await repository.rotateRefreshToken({
        tokenId: storedToken.id,
        familyId: storedToken.familyId,
        revokedAt: requestedAt,
        replacement: replacement.refreshToken,
      });

      if (!rotated) {
        await repository.revokeRefreshTokenFamily({
          familyId: storedToken.familyId,
          revokedAt: requestedAt,
        });
        throw new UnauthorizedError(MESSAGES.invalidSession);
      }

      return {
        user: serializeUser(storedToken.user),
        tokens: replacement.tokens,
      };
    },

    async logout({ refreshToken }) {
      if (refreshToken) {
        await repository.revokeRefreshTokenByHash({
          tokenHash: hashOpaqueToken(refreshToken),
          revokedAt: now(),
        });
      }
    },

    async logoutAll({ userId }) {
      await repository.revokeAllRefreshTokensForUser({
        userId,
        revokedAt: now(),
      });
    },

    async authenticateAccessToken(accessToken) {
      if (!accessToken) throw new UnauthorizedError(MESSAGES.unauthorized);

      try {
        const { payload } = await jwtVerify(accessToken, signingKey, {
          algorithms: [AUTH.accessTokenAlgorithm],
          audience: config.jwtAudience,
          issuer: config.jwtIssuer,
        });

        if (
          typeof payload.sub !== 'string' ||
          typeof payload.role !== 'string'
        ) {
          throw new Error('Access token claims are invalid.');
        }

        return { userId: payload.sub, role: payload.role };
      } catch {
        throw new UnauthorizedError(MESSAGES.unauthorized);
      }
    },

    async getCurrentUser({ userId }) {
      const user = await repository.findUserById(userId);
      if (!user) throw new UnauthorizedError(MESSAGES.unauthorized);
      return serializeUser(user);
    },

    async updateProfile({ userId, fullName }) {
      const user = await repository.updateUserProfile({ userId, fullName });
      if (!user) throw new UnauthorizedError(MESSAGES.unauthorized);
      return serializeUser(user);
    },

    async requestPasswordReset({ email }) {
      const user = await repository.findUserByEmail(email);
      if (!user || !sendPasswordReset) {
        return { message: MESSAGES.passwordResetRequested };
      }

      const token = createOpaqueToken(AUTH.passwordResetTokenBytes);
      const requestedAt = now();
      const expiresAt = new Date(
        requestedAt.getTime() + config.passwordResetTtlMinutes * 60 * 1000,
      );
      await repository.issuePasswordResetToken({
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
        now: requestedAt,
      });
      await sendPasswordReset({
        user: serializeUser(user),
        token,
        expiresAt,
      });

      return { message: MESSAGES.passwordResetRequested };
    },

    async resetPassword({ token, password }) {
      const user = await repository.resetPasswordWithToken({
        tokenHash: hashOpaqueToken(token),
        passwordHash: await hashPassword(password),
        now: now(),
      });
      if (!user) throw new UnauthorizedError(MESSAGES.invalidPasswordReset);

      return { message: 'Your password has been reset. Please sign in.' };
    },
  });
}
