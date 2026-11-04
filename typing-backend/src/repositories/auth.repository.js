import { AUTH, TOKEN_STATUSES, USER_STATUSES } from '../constants/auth.js';

const userRoles = Object.freeze({
  roleAssignments: { select: { roleName: true } },
});

function activeSessionWhere(now) {
  return { revokedAt: null, expiresAt: { gt: now } };
}

async function lockUser(transaction, userId) {
  await transaction.$queryRaw`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${userId} FOR UPDATE`;
}

async function lockSession(transaction, sessionId) {
  await transaction.$queryRaw`SELECT \`id\` FROM \`Session\` WHERE \`id\` = ${sessionId} FOR UPDATE`;
}

function auditData(audit, overrides = {}) {
  return {
    eventType: audit.eventType,
    userId: audit.userId || null,
    sessionId: audit.sessionId || null,
    requestId: audit.requestId || null,
    ipAddress: audit.ipAddress || null,
    userAgent: audit.userAgent || null,
    outcome: audit.outcome || 'SUCCESS',
    metadata: audit.metadata || undefined,
    ...overrides,
  };
}

async function revokeSession(transaction, { sessionId, revokedAt, reason }) {
  await transaction.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: {
      revokedAt,
      revocationReason: reason,
      version: { increment: 1 },
    },
  });
  await transaction.refreshToken.updateMany({
    where: { sessionId, status: TOKEN_STATUSES.active },
    data: {
      status: TOKEN_STATUSES.revoked,
      revokedAt,
      revocationReason: reason,
      version: { increment: 1 },
    },
  });
}

export function createAuthRepository(prisma) {
  return Object.freeze({
    findUserByEmail: (normalizedEmail) =>
      prisma.user.findUnique({
        where: { normalizedEmail },
        include: userRoles,
      }),

    findUserById: (id) =>
      prisma.user.findUnique({ where: { id }, include: userRoles }),

    async createPendingUser({
      user,
      roleName,
      verificationToken,
      outbox,
      audit,
    }) {
      return prisma.$transaction(async (transaction) => {
        await transaction.role.upsert({
          where: { name: roleName },
          create: {
            name: roleName,
            description: 'Standard application user',
          },
          update: {},
        });
        const created = await transaction.user.create({ data: user });
        await transaction.userRoleAssignment.create({
          data: { userId: created.id, roleName },
        });
        await transaction.emailVerificationToken.create({
          data: { ...verificationToken, userId: created.id },
        });
        await transaction.notificationOutbox.create({
          data: { ...outbox, userId: created.id },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, { userId: created.id }),
        });
        return transaction.user.findUnique({
          where: { id: created.id },
          include: userRoles,
        });
      });
    },

    async verifyEmail({ tokenHash, now, audit }) {
      return prisma.$transaction(async (transaction) => {
        const token = await transaction.emailVerificationToken.findUnique({
          where: { tokenHash },
        });
        if (!token) return { kind: 'invalid' };
        await lockUser(transaction, token.userId);
        const [currentToken, user] = await Promise.all([
          transaction.emailVerificationToken.findUnique({
            where: { id: token.id },
          }),
          transaction.user.findUnique({
            where: { id: token.userId },
            include: userRoles,
          }),
        ]);
        if (
          !user ||
          [USER_STATUSES.disabled, USER_STATUSES.deleted].includes(user.status)
        ) {
          return { kind: 'invalid' };
        }
        if (user.status === USER_STATUSES.active && user.emailVerifiedAt) {
          return { kind: 'already_verified', user };
        }
        if (
          !currentToken ||
          currentToken.consumedAt ||
          currentToken.expiresAt <= now
        ) {
          return { kind: 'invalid' };
        }
        const consumed = await transaction.emailVerificationToken.updateMany({
          where: {
            id: currentToken.id,
            consumedAt: null,
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        });
        if (!consumed.count) return { kind: 'invalid' };
        await transaction.emailVerificationToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.user.update({
          where: { id: user.id },
          data: {
            status: USER_STATUSES.active,
            emailVerifiedAt: now,
            failedLoginAttempts: 0,
            lockedUntil: null,
            version: { increment: 1 },
          },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, { userId: user.id }),
        });
        return {
          kind: 'verified',
          user: await transaction.user.findUnique({
            where: { id: user.id },
            include: userRoles,
          }),
        };
      });
    },

    async replaceVerificationToken({ userId, token, outbox, now, audit }) {
      return prisma.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const user = await transaction.user.findUnique({
          where: { id: userId },
        });
        if (!user || user.status !== USER_STATUSES.pending) return false;
        await transaction.emailVerificationToken.updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.emailVerificationToken.create({
          data: { ...token, userId },
        });
        await transaction.notificationOutbox.create({
          data: { ...outbox, userId },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, { userId }),
        });
        return true;
      });
    },

    async unlockExpiredAccount({ userId, now }) {
      await prisma.user.updateMany({
        where: {
          id: userId,
          status: USER_STATUSES.locked,
          emailVerifiedAt: { not: null },
          deletedAt: null,
          lockedUntil: { lte: now },
        },
        data: {
          status: USER_STATUSES.active,
          lockedUntil: null,
          failedLoginAttempts: 0,
          version: { increment: 1 },
        },
      });
      return prisma.user.findUnique({
        where: { id: userId },
        include: userRoles,
      });
    },

    async recordSigninFailure({
      userId,
      now,
      lockoutThreshold,
      lockedUntil,
      audit,
    }) {
      return prisma.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const user = await transaction.user.findUnique({
          where: { id: userId },
        });
        if (!user) return null;
        const attempts = user.failedLoginAttempts + 1;
        const lockEligible = [
          USER_STATUSES.active,
          USER_STATUSES.locked,
        ].includes(user.status);
        const shouldLock = lockEligible && attempts >= lockoutThreshold;
        const updated = await transaction.user.update({
          where: { id: userId },
          data: {
            failedLoginAttempts: attempts,
            ...(shouldLock
              ? { status: USER_STATUSES.locked, lockedUntil }
              : {}),
            version: { increment: 1 },
          },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, {
            userId,
            eventType: shouldLock ? 'ACCOUNT_LOCKED' : 'SIGNIN_FAILURE',
            outcome: 'FAILURE',
            metadata: {
              attempts,
              locked: shouldLock,
              occurredAt: now.toISOString(),
            },
          }),
        });
        return updated;
      });
    },

    async createSession({ userId, session, refreshToken, now, audit }) {
      return prisma.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const user = await transaction.user.findUnique({
          where: { id: userId },
          include: userRoles,
        });
        if (!user || user.status !== USER_STATUSES.active) return null;
        const createdSession = await transaction.session.create({
          data: { ...session, userId },
        });
        await transaction.refreshToken.create({
          data: {
            ...refreshToken,
            sessionId: createdSession.id,
            familyId: createdSession.familyId,
          },
        });
        const updatedUser = await transaction.user.update({
          where: { id: userId },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: now,
            version: { increment: 1 },
          },
          include: userRoles,
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, {
            userId,
            sessionId: createdSession.id,
          }),
        });
        return { user: updatedUser, session: createdSession };
      });
    },

    async findRefreshSessionByHash(tokenHash, now) {
      const token = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { session: true },
      });
      if (
        !token ||
        token.status !== TOKEN_STATUSES.active ||
        token.expiresAt <= now ||
        token.session.revokedAt ||
        token.session.expiresAt <= now
      ) {
        return null;
      }
      return { sessionId: token.sessionId };
    },

    async findRefreshTokenContext(tokenHash) {
      const token = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { sessionId: true },
      });
      return token ? { sessionId: token.sessionId } : null;
    },

    async rotateRefreshToken({
      tokenHash,
      expectedSessionId,
      replacement,
      now,
      metadata,
      audit,
    }) {
      return prisma.$transaction(async (transaction) => {
        const initialToken = await transaction.refreshToken.findUnique({
          where: { tokenHash },
        });
        if (!initialToken) return { kind: 'invalid' };
        await lockSession(transaction, initialToken.sessionId);
        const token = await transaction.refreshToken.findUnique({
          where: { id: initialToken.id },
          include: {
            session: {
              include: { user: { include: userRoles } },
            },
          },
        });
        if (!token) return { kind: 'invalid' };
        if (token.sessionId !== expectedSessionId) {
          return { kind: 'csrf_mismatch' };
        }

        if (
          token.status !== TOKEN_STATUSES.active ||
          token.usedAt ||
          token.revokedAt
        ) {
          await revokeSession(transaction, {
            sessionId: token.sessionId,
            revokedAt: now,
            reason: AUTH.sessionRevocationReasons.refreshReuse,
          });
          await transaction.securityAuditEvent.create({
            data: auditData(audit, {
              eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
              userId: token.session.userId,
              sessionId: token.sessionId,
              outcome: 'FAILURE',
            }),
          });
          return { kind: 'reused' };
        }

        const { session } = token;
        const { user } = session;
        if (
          token.expiresAt <= now ||
          session.revokedAt ||
          session.expiresAt <= now ||
          user.status !== USER_STATUSES.active
        ) {
          await revokeSession(transaction, {
            sessionId: token.sessionId,
            revokedAt: now,
            reason: AUTH.sessionRevocationReasons.userRevoked,
          });
          return { kind: 'invalid' };
        }

        const createdReplacement = await transaction.refreshToken.create({
          data: {
            ...replacement,
            sessionId: session.id,
            familyId: session.familyId,
          },
        });
        const rotated = await transaction.refreshToken.updateMany({
          where: {
            id: token.id,
            status: TOKEN_STATUSES.active,
            usedAt: null,
            revokedAt: null,
          },
          data: {
            status: TOKEN_STATUSES.rotated,
            usedAt: now,
            replacedByTokenId: createdReplacement.id,
            version: { increment: 1 },
          },
        });
        if (!rotated.count) {
          await transaction.refreshToken.delete({
            where: { id: createdReplacement.id },
          });
          await revokeSession(transaction, {
            sessionId: session.id,
            revokedAt: now,
            reason: AUTH.sessionRevocationReasons.refreshReuse,
          });
          await transaction.securityAuditEvent.create({
            data: auditData(audit, {
              eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
              userId: user.id,
              sessionId: session.id,
              outcome: 'FAILURE',
            }),
          });
          return { kind: 'reused' };
        }
        const updatedSession = await transaction.session.update({
          where: { id: session.id },
          data: {
            lastActivityAt: now,
            userAgent: metadata.userAgent || session.userAgent,
            ipAddress: metadata.ipAddress || session.ipAddress,
            version: { increment: 1 },
          },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, {
            userId: user.id,
            sessionId: session.id,
          }),
        });
        return { kind: 'rotated', user, session: updatedSession };
      });
    },

    async getAuthorizationState({ userId, sessionId }) {
      const session = await prisma.session.findFirst({
        where: { id: sessionId, userId },
        include: { user: { include: userRoles } },
      });
      return session ? { session, user: session.user } : null;
    },

    updateUserProfile: async ({ userId, fullName }) => {
      const updated = await prisma.user.updateMany({
        where: { id: userId, status: USER_STATUSES.active },
        data: { fullName, version: { increment: 1 } },
      });
      if (!updated.count) return null;
      return prisma.user.findUnique({
        where: { id: userId },
        include: userRoles,
      });
    },

    async revokeSessionByRefreshHash({ tokenHash, now, reason, audit }) {
      return prisma.$transaction(async (transaction) => {
        const token = await transaction.refreshToken.findUnique({
          where: { tokenHash },
        });
        if (!token) return false;
        await lockSession(transaction, token.sessionId);
        await revokeSession(transaction, {
          sessionId: token.sessionId,
          revokedAt: now,
          reason,
        });
        const session = await transaction.session.findUnique({
          where: { id: token.sessionId },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, {
            userId: session.userId,
            sessionId: session.id,
          }),
        });
        return true;
      });
    },

    async revokeAllSessions({ userId, now, reason, audit }) {
      return prisma.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const sessions = await transaction.session.findMany({
          where: { userId, ...activeSessionWhere(now) },
          select: { id: true },
        });
        await transaction.session.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: reason,
            version: { increment: 1 },
          },
        });
        await transaction.refreshToken.updateMany({
          where: { session: { userId }, status: TOKEN_STATUSES.active },
          data: {
            status: TOKEN_STATUSES.revoked,
            revokedAt: now,
            revocationReason: reason,
            version: { increment: 1 },
          },
        });
        const user = await transaction.user.update({
          where: { id: userId },
          data: {
            securityVersion: { increment: 1 },
            version: { increment: 1 },
          },
          include: userRoles,
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, {
            userId,
            metadata: { revokedSessions: sessions.length },
          }),
        });
        return user;
      });
    },

    listSessions({ userId, limit, cursor, now }) {
      return prisma.session.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: now } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
    },

    async revokeOwnedSession({ userId, sessionId, now, audit }) {
      return prisma.$transaction(async (transaction) => {
        const session = await transaction.session.findFirst({
          where: { id: sessionId, userId },
        });
        if (!session) return false;
        await lockSession(transaction, sessionId);
        await revokeSession(transaction, {
          sessionId,
          revokedAt: now,
          reason: 'USER_SESSION_REVOKED',
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, { userId, sessionId }),
        });
        return true;
      });
    },

    async issuePasswordResetToken({ userId, token, outbox, now, audit }) {
      return prisma.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const user = await transaction.user.findUnique({
          where: { id: userId },
        });
        if (
          !user ||
          ![USER_STATUSES.active, USER_STATUSES.locked].includes(user.status)
        ) {
          return false;
        }
        await transaction.passwordResetToken.updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.passwordResetToken.create({
          data: { ...token, userId },
        });
        await transaction.notificationOutbox.create({
          data: { ...outbox, userId },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, { userId }),
        });
        return true;
      });
    },

    async resetPassword({ tokenHash, passwordHash, now, audit, outbox }) {
      return prisma.$transaction(async (transaction) => {
        const token = await transaction.passwordResetToken.findUnique({
          where: { tokenHash },
        });
        if (!token) return null;
        await lockUser(transaction, token.userId);
        const current = await transaction.passwordResetToken.findUnique({
          where: { id: token.id },
        });
        const user = await transaction.user.findUnique({
          where: { id: token.userId },
        });
        if (
          !current ||
          current.consumedAt ||
          current.expiresAt <= now ||
          !user ||
          [USER_STATUSES.disabled, USER_STATUSES.deleted].includes(user.status)
        ) {
          return null;
        }
        const consumed = await transaction.passwordResetToken.updateMany({
          where: { id: current.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (!consumed.count) return null;
        await transaction.passwordResetToken.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: AUTH.sessionRevocationReasons.passwordReset,
            version: { increment: 1 },
          },
        });
        await transaction.refreshToken.updateMany({
          where: {
            session: { userId: user.id },
            status: TOKEN_STATUSES.active,
          },
          data: {
            status: TOKEN_STATUSES.revoked,
            revokedAt: now,
            revocationReason: AUTH.sessionRevocationReasons.passwordReset,
            version: { increment: 1 },
          },
        });
        const updated = await transaction.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            credentialsChangedAt: now,
            securityVersion: { increment: 1 },
            failedLoginAttempts: 0,
            lockedUntil: null,
            status: USER_STATUSES.active,
            version: { increment: 1 },
          },
          include: userRoles,
        });
        await transaction.notificationOutbox.create({
          data: {
            ...outbox,
            recipient: user.email,
            payload: {
              ...outbox.payload,
              user: { id: user.id, fullName: user.fullName },
            },
            userId: user.id,
          },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, { userId: user.id }),
        });
        return updated;
      });
    },

    async changePassword({
      userId,
      expectedVersion,
      passwordHash,
      now,
      audit,
      outbox,
    }) {
      return prisma.$transaction(async (transaction) => {
        await lockUser(transaction, userId);
        const changed = await transaction.user.updateMany({
          where: {
            id: userId,
            version: expectedVersion,
            status: USER_STATUSES.active,
          },
          data: {
            passwordHash,
            credentialsChangedAt: now,
            securityVersion: { increment: 1 },
            version: { increment: 1 },
          },
        });
        if (!changed.count) return null;
        await transaction.passwordResetToken.updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: now },
        });
        await transaction.session.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: now,
            revocationReason: AUTH.sessionRevocationReasons.passwordChanged,
            version: { increment: 1 },
          },
        });
        await transaction.refreshToken.updateMany({
          where: { session: { userId }, status: TOKEN_STATUSES.active },
          data: {
            status: TOKEN_STATUSES.revoked,
            revokedAt: now,
            revocationReason: AUTH.sessionRevocationReasons.passwordChanged,
            version: { increment: 1 },
          },
        });
        await transaction.notificationOutbox.create({
          data: { ...outbox, userId },
        });
        await transaction.securityAuditEvent.create({
          data: auditData(audit, { userId }),
        });
        return transaction.user.findUnique({
          where: { id: userId },
          include: userRoles,
        });
      });
    },

    createAudit(audit) {
      return prisma.securityAuditEvent.create({ data: auditData(audit) });
    },
  });
}
