import { randomUUID } from 'node:crypto';

import { createPassagesRepository } from '../src/repositories/passages.repository.js';
import { createWordsRepository } from '../src/repositories/words.repository.js';
import { hashOpaqueToken } from '../src/services/token.service.js';

const samplePassage = {
  key: 'p-test',
  text: 'steady practice makes each careful movement easier to repeat while patient attention builds accuracy and confidence through small corrections repeated calmly during every focused session with clear goals and honest feedback',
  difficulty: 'easy',
  category: 'test',
};

export function createFakeRepositories() {
  const sessions = new Map();
  const users = new Map();
  const userIdsByEmail = new Map();
  const authSessions = new Map();
  const refreshTokens = new Map();
  const refreshTokenIdsByHash = new Map();
  const verificationTokens = new Map();
  const passwordResetTokens = new Map();
  const outbox = [];
  const audits = [];

  function findUser(email) {
    const userId = userIdsByEmail.get(email);
    return userId ? users.get(userId) : null;
  }

  function revokeSession(sessionId, revokedAt, reason) {
    const session = authSessions.get(sessionId);
    if (!session) return;
    session.revokedAt = session.revokedAt || revokedAt;
    session.revocationReason = session.revocationReason || reason;
    for (const token of refreshTokens.values()) {
      if (token.sessionId === sessionId && token.status === 'ACTIVE') {
        token.status = 'REVOKED';
        token.revokedAt = revokedAt;
        token.revocationReason = reason;
      }
    }
  }

  const auth = {
    findUserByEmail: async (email) => findUser(email),
    findUserById: async (id) => users.get(id) || null,
    createPendingUser: async ({
      user: data,
      roleName,
      verificationToken,
      outbox: outboxEvent,
      audit,
    }) => {
      if (findUser(data.normalizedEmail)) {
        const error = new Error('Unique constraint failed.');
        error.code = 'P2002';
        throw error;
      }
      const timestamp = new Date();
      const user = {
        status: 'PENDING_VERIFICATION',
        securityVersion: 1,
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerifiedAt: null,
        deletedAt: null,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        roleAssignments: [{ roleName }],
        ...data,
      };
      users.set(user.id, user);
      userIdsByEmail.set(user.normalizedEmail, user.id);
      verificationTokens.set(verificationToken.tokenHash, {
        id: randomUUID(),
        userId: user.id,
        consumedAt: null,
        ...verificationToken,
      });
      outbox.push({ ...outboxEvent, userId: user.id });
      audits.push({ ...audit, userId: user.id });
      return user;
    },

    verifyEmail: async ({ tokenHash, now, audit }) => {
      const token = verificationTokens.get(tokenHash);
      if (!token) return { kind: 'invalid' };
      const user = users.get(token.userId);
      if (!user || ['DISABLED', 'DELETED'].includes(user.status)) {
        return { kind: 'invalid' };
      }
      if (user.status === 'ACTIVE' && user.emailVerifiedAt) {
        return { kind: 'already_verified', user };
      }
      if (token.consumedAt || token.expiresAt <= now) {
        return { kind: 'invalid' };
      }
      token.consumedAt = now;
      for (const item of verificationTokens.values()) {
        if (item.userId === user.id && !item.consumedAt) item.consumedAt = now;
      }
      user.status = 'ACTIVE';
      user.emailVerifiedAt = now;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      user.version += 1;
      audits.push({ ...audit, userId: user.id });
      return { kind: 'verified', user };
    },

    replaceVerificationToken: async ({
      userId,
      token,
      outbox: outboxEvent,
      now,
      audit,
    }) => {
      const user = users.get(userId);
      if (!user || user.status !== 'PENDING_VERIFICATION') return false;
      for (const item of verificationTokens.values()) {
        if (item.userId === userId && !item.consumedAt) item.consumedAt = now;
      }
      verificationTokens.set(token.tokenHash, {
        id: randomUUID(),
        userId,
        consumedAt: null,
        ...token,
      });
      outbox.push({ ...outboxEvent, userId });
      audits.push({ ...audit, userId });
      return true;
    },

    unlockExpiredAccount: async ({ userId, now }) => {
      const user = users.get(userId);
      if (
        user?.status === 'LOCKED' &&
        user.emailVerifiedAt &&
        !user.deletedAt &&
        user.lockedUntil <= now
      ) {
        user.status = 'ACTIVE';
        user.lockedUntil = null;
        user.failedLoginAttempts = 0;
        user.version += 1;
      }
      return user;
    },

    recordSigninFailure: async ({
      userId,
      now,
      lockoutThreshold,
      lockedUntil,
      audit,
    }) => {
      const user = users.get(userId);
      if (!user) return null;
      user.failedLoginAttempts += 1;
      if (
        ['ACTIVE', 'LOCKED'].includes(user.status) &&
        user.failedLoginAttempts >= lockoutThreshold
      ) {
        user.status = 'LOCKED';
        user.lockedUntil = lockedUntil;
      }
      user.updatedAt = now;
      user.version += 1;
      audits.push({ ...audit, userId });
      return user;
    },

    createSession: async ({ userId, session, refreshToken, now, audit }) => {
      const user = users.get(userId);
      if (!user || user.status !== 'ACTIVE') return null;
      const createdSession = {
        createdAt: now,
        revokedAt: null,
        ...session,
        userId,
      };
      authSessions.set(createdSession.id, createdSession);
      const token = {
        createdAt: now,
        usedAt: null,
        revokedAt: null,
        ...refreshToken,
        sessionId: createdSession.id,
        familyId: createdSession.familyId,
      };
      refreshTokens.set(token.id, token);
      refreshTokenIdsByHash.set(token.tokenHash, token.id);
      user.lastLoginAt = now;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      user.version += 1;
      audits.push({ ...audit, userId, sessionId: createdSession.id });
      return { user, session: createdSession };
    },

    findRefreshSessionByHash: async (tokenHash, now) => {
      const tokenId = refreshTokenIdsByHash.get(tokenHash);
      const token = tokenId ? refreshTokens.get(tokenId) : null;
      const session = token ? authSessions.get(token.sessionId) : null;
      if (
        !token ||
        token.status !== 'ACTIVE' ||
        token.expiresAt <= now ||
        !session ||
        session.revokedAt ||
        session.expiresAt <= now
      ) {
        return null;
      }
      return { sessionId: session.id };
    },

    findRefreshTokenContext: async (tokenHash) => {
      const tokenId = refreshTokenIdsByHash.get(tokenHash);
      const token = tokenId ? refreshTokens.get(tokenId) : null;
      return token ? { sessionId: token.sessionId } : null;
    },

    rotateRefreshToken: async ({
      tokenHash,
      expectedSessionId,
      replacement,
      now,
      metadata,
      audit,
    }) => {
      const tokenId = refreshTokenIdsByHash.get(tokenHash);
      const token = tokenId ? refreshTokens.get(tokenId) : null;
      if (!token) return { kind: 'invalid' };
      const session = authSessions.get(token.sessionId);
      if (token.sessionId !== expectedSessionId)
        return { kind: 'csrf_mismatch' };
      if (token.status !== 'ACTIVE' || token.usedAt || token.revokedAt) {
        revokeSession(session.id, now, 'REFRESH_TOKEN_REUSE');
        audits.push({
          ...audit,
          eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
          userId: session.userId,
          sessionId: session.id,
        });
        return { kind: 'reused' };
      }
      const user = users.get(session.userId);
      if (
        token.expiresAt <= now ||
        session.revokedAt ||
        session.expiresAt <= now ||
        user.status !== 'ACTIVE'
      ) {
        revokeSession(session.id, now, 'USER_REVOKED');
        return { kind: 'invalid' };
      }
      token.status = 'ROTATED';
      token.usedAt = now;
      token.replacedByTokenId = replacement.id;
      const created = {
        createdAt: now,
        usedAt: null,
        revokedAt: null,
        ...replacement,
        sessionId: session.id,
        familyId: session.familyId,
      };
      refreshTokens.set(created.id, created);
      refreshTokenIdsByHash.set(created.tokenHash, created.id);
      session.lastActivityAt = now;
      session.userAgent = metadata.userAgent || session.userAgent;
      session.ipAddress = metadata.ipAddress || session.ipAddress;
      audits.push({ ...audit, userId: user.id, sessionId: session.id });
      return { kind: 'rotated', user, session };
    },

    getAuthorizationState: async ({ userId, sessionId }) => {
      const session = authSessions.get(sessionId);
      const user = users.get(userId);
      return session?.userId === userId && user ? { session, user } : null;
    },

    updateUserProfile: async ({ userId, fullName }) => {
      const user = users.get(userId);
      if (!user || user.status !== 'ACTIVE') return null;
      user.fullName = fullName;
      user.updatedAt = new Date();
      user.version += 1;
      return user;
    },

    revokeSessionByRefreshHash: async ({ tokenHash, now, reason, audit }) => {
      const tokenId = refreshTokenIdsByHash.get(tokenHash);
      const token = tokenId ? refreshTokens.get(tokenId) : null;
      if (!token) return false;
      const session = authSessions.get(token.sessionId);
      revokeSession(token.sessionId, now, reason);
      audits.push({ ...audit, userId: session.userId, sessionId: session.id });
      return true;
    },

    revokeAllSessions: async ({ userId, now, reason, audit }) => {
      for (const session of authSessions.values()) {
        if (session.userId === userId && !session.revokedAt) {
          revokeSession(session.id, now, reason);
        }
      }
      const user = users.get(userId);
      user.securityVersion += 1;
      user.version += 1;
      audits.push({ ...audit, userId });
      return user;
    },

    listSessions: async ({ userId, limit, now }) =>
      [...authSessions.values()]
        .filter(
          (session) =>
            session.userId === userId &&
            !session.revokedAt &&
            session.expiresAt > now,
        )
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit + 1),

    revokeOwnedSession: async ({ userId, sessionId, now, audit }) => {
      const session = authSessions.get(sessionId);
      if (!session || session.userId !== userId) return false;
      revokeSession(sessionId, now, 'USER_SESSION_REVOKED');
      audits.push({ ...audit, userId, sessionId });
      return true;
    },

    issuePasswordResetToken: async ({
      userId,
      token,
      outbox: outboxEvent,
      now,
      audit,
    }) => {
      const user = users.get(userId);
      if (!user || !['ACTIVE', 'LOCKED'].includes(user.status)) return false;
      for (const item of passwordResetTokens.values()) {
        if (item.userId === userId && !item.consumedAt) {
          item.consumedAt = now;
        }
      }
      passwordResetTokens.set(token.tokenHash, {
        id: randomUUID(),
        userId,
        consumedAt: null,
        createdAt: now,
        ...token,
      });
      outbox.push({ ...outboxEvent, userId });
      audits.push({ ...audit, userId });
      return true;
    },

    resetPassword: async ({
      tokenHash,
      passwordHash,
      now,
      audit,
      outbox: event,
    }) => {
      const resetToken = passwordResetTokens.get(tokenHash);
      if (!resetToken || resetToken.consumedAt || resetToken.expiresAt <= now) {
        return null;
      }
      const user = users.get(resetToken.userId);
      if (!user || ['DISABLED', 'DELETED'].includes(user.status)) return null;
      resetToken.consumedAt = now;
      for (const item of passwordResetTokens.values()) {
        if (item.userId === user.id && !item.consumedAt) item.consumedAt = now;
      }
      user.passwordHash = passwordHash;
      user.credentialsChangedAt = now;
      user.securityVersion += 1;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      user.status = 'ACTIVE';
      user.version += 1;
      user.updatedAt = now;
      for (const session of authSessions.values()) {
        if (session.userId === user.id)
          revokeSession(session.id, now, 'PASSWORD_RESET');
      }
      outbox.push({
        ...event,
        recipient: user.email,
        payload: {
          ...event.payload,
          user: { id: user.id, fullName: user.fullName },
        },
        userId: user.id,
      });
      audits.push({ ...audit, userId: user.id });
      return user;
    },

    changePassword: async ({
      userId,
      expectedVersion,
      passwordHash,
      now,
      audit,
      outbox: event,
    }) => {
      const user = users.get(userId);
      if (
        !user ||
        user.status !== 'ACTIVE' ||
        user.version !== expectedVersion
      ) {
        return null;
      }
      user.passwordHash = passwordHash;
      user.credentialsChangedAt = now;
      user.securityVersion += 1;
      user.version += 1;
      for (const session of authSessions.values()) {
        if (session.userId === userId)
          revokeSession(session.id, now, 'PASSWORD_CHANGED');
      }
      for (const item of passwordResetTokens.values()) {
        if (item.userId === userId && !item.consumedAt) item.consumedAt = now;
      }
      outbox.push({ ...event, userId });
      audits.push({ ...audit, userId });
      return user;
    },

    createAudit: async (audit) => {
      audits.push(audit);
      return audit;
    },

    _testing: {
      activateUser(email) {
        const user = findUser(email);
        user.status = 'ACTIVE';
        user.emailVerifiedAt = new Date();
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        return user;
      },
      setVerificationToken(email, rawToken, expiresAt) {
        const user = findUser(email);
        verificationTokens.set(hashOpaqueToken(rawToken), {
          id: randomUUID(),
          userId: user.id,
          tokenHash: hashOpaqueToken(rawToken),
          expiresAt,
          consumedAt: null,
        });
      },
      setResetToken(email, rawToken, expiresAt) {
        const user = findUser(email);
        passwordResetTokens.set(hashOpaqueToken(rawToken), {
          id: randomUUID(),
          userId: user.id,
          tokenHash: hashOpaqueToken(rawToken),
          expiresAt,
          consumedAt: null,
        });
      },
      setStatus(email, status, extra = {}) {
        Object.assign(findUser(email), { status, ...extra });
      },
      setRoles(email, roleNames) {
        findUser(email).roleAssignments = roleNames.map((roleName) => ({
          roleName,
        }));
      },
      users,
      sessions: authSessions,
      refreshTokens,
      outbox,
      audits,
    },
  };

  const testSessions = {
    create: async (data) => {
      const session = { id: randomUUID(), ...data };
      sessions.set(session.id, session);
      return session;
    },
    findById: async (id) => sessions.get(id) || null,
    claimSubmission: async ({ id, clientId, data }) => {
      const session = sessions.get(id);
      if (
        !session ||
        session.clientId !== clientId ||
        session.status !== 'STARTED'
      )
        return { count: 0 };
      Object.assign(session, data);
      return { count: 1 };
    },
    markRejected: async ({ id, clientId, reason }) => {
      const session = sessions.get(id);
      if (
        !session ||
        session.clientId !== clientId ||
        session.status !== 'STARTED'
      )
        return { count: 0 };
      session.status = 'REJECTED';
      session.rejectReason = reason;
      return { count: 1 };
    },
    findSubmitted: async ({ clientId, limit }) =>
      [...sessions.values()]
        .filter(
          (session) =>
            session.clientId === clientId && session.status === 'SUBMITTED',
        )
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit + 1),
    aggregateSubmitted: async ({ clientId }) => {
      const items = [...sessions.values()].filter(
        (session) =>
          session.clientId === clientId && session.status === 'SUBMITTED',
      );
      return {
        _count: { _all: items.length },
        _avg: {
          wpm: items.length
            ? items.reduce((sum, item) => sum + item.wpm, 0) / items.length
            : null,
          accuracy: items.length
            ? items.reduce((sum, item) => sum + item.accuracy, 0) / items.length
            : null,
        },
      };
    },
    bestSubmitted: async ({ clientId }) => {
      const values = [...sessions.values()]
        .filter(
          (session) =>
            session.clientId === clientId && session.status === 'SUBMITTED',
        )
        .map((session) => session.wpm);
      return { _max: { wpm: values.length ? Math.max(...values) : null } };
    },
    groupByMode: async ({ clientId }) => {
      const items = [...sessions.values()].filter(
        (session) =>
          session.clientId === clientId && session.status === 'SUBMITTED',
      );
      return ['TIMED', 'PASSAGE']
        .map((mode) => items.filter((item) => item.mode === mode))
        .filter((group) => group.length)
        .map((group) => ({
          mode: group[0].mode,
          _count: { _all: group.length },
          _avg: {
            wpm: group.reduce((sum, item) => sum + item.wpm, 0) / group.length,
            accuracy:
              group.reduce((sum, item) => sum + item.accuracy, 0) /
              group.length,
          },
        }));
    },
  };

  return {
    auth,
    passages: createPassagesRepository({ source: [samplePassage] }),
    words: createWordsRepository({
      source: Array.from(
        { length: 500 },
        (_, index) => `word${'a'.repeat(index + 1)}`,
      ),
    }),
    testSessions,
  };
}
