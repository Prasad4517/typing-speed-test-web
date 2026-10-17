import { randomUUID } from 'node:crypto';

import { createPassagesRepository } from '../src/repositories/passages.repository.js';
import { createWordsRepository } from '../src/repositories/words.repository.js';

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
  const refreshTokens = new Map();
  const refreshTokenIdsByHash = new Map();
  const passwordResetTokens = new Map();
  const passwordResetTokenIdsByHash = new Map();

  const auth = {
    findUserByEmail: async (email) => {
      const userId = userIdsByEmail.get(email);
      return userId ? users.get(userId) : null;
    },
    findUserById: async (id) => users.get(id) || null,
    createUser: async (data) => {
      const user = {
        id: randomUUID(),
        role: 'USER',
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      users.set(user.id, user);
      userIdsByEmail.set(user.email, user.id);
      return user;
    },
    updateUserProfile: async ({ userId, fullName }) => {
      const user = users.get(userId);
      if (!user) throw new Error('User not found.');
      user.fullName = fullName;
      user.updatedAt = new Date();
      return user;
    },
    findRefreshTokenByHash: async (tokenHash) => {
      const tokenId = refreshTokenIdsByHash.get(tokenHash);
      const token = tokenId ? refreshTokens.get(tokenId) : null;
      return token ? { ...token, user: users.get(token.userId) } : null;
    },
    createRefreshToken: async (data) => {
      const token = { createdAt: new Date(), revokedAt: null, ...data };
      refreshTokens.set(token.id, token);
      refreshTokenIdsByHash.set(token.tokenHash, token.id);
      return token;
    },
    rotateRefreshToken: async ({
      tokenId,
      familyId,
      revokedAt,
      replacement,
    }) => {
      const token = refreshTokens.get(tokenId);
      if (
        !token ||
        token.familyId !== familyId ||
        token.revokedAt ||
        token.expiresAt <= revokedAt
      ) {
        return null;
      }
      token.revokedAt = revokedAt;
      token.replacedByTokenId = replacement.id;
      return auth.createRefreshToken(replacement);
    },
    revokeRefreshTokenByHash: async ({ tokenHash, revokedAt }) => {
      const tokenId = refreshTokenIdsByHash.get(tokenHash);
      const token = tokenId ? refreshTokens.get(tokenId) : null;
      if (!token || token.revokedAt) return { count: 0 };
      token.revokedAt = revokedAt;
      return { count: 1 };
    },
    revokeRefreshTokenFamily: async ({ familyId, revokedAt }) => {
      let count = 0;
      for (const token of refreshTokens.values()) {
        if (token.familyId !== familyId || token.revokedAt) continue;
        token.revokedAt = revokedAt;
        count += 1;
      }
      return { count };
    },
    revokeAllRefreshTokensForUser: async ({ userId, revokedAt }) => {
      let count = 0;
      for (const token of refreshTokens.values()) {
        if (token.userId !== userId || token.revokedAt) continue;
        token.revokedAt = revokedAt;
        count += 1;
      }
      return { count };
    },
    issuePasswordResetToken: async ({ userId, tokenHash, expiresAt, now }) => {
      for (const resetToken of passwordResetTokens.values()) {
        if (resetToken.userId === userId && !resetToken.usedAt) {
          resetToken.usedAt = now;
        }
      }
      const resetToken = {
        id: randomUUID(),
        userId,
        tokenHash,
        expiresAt,
        usedAt: null,
        createdAt: now,
      };
      passwordResetTokens.set(resetToken.id, resetToken);
      passwordResetTokenIdsByHash.set(tokenHash, resetToken.id);
      return resetToken;
    },
    resetPasswordWithToken: async ({ tokenHash, passwordHash, now }) => {
      const tokenId = passwordResetTokenIdsByHash.get(tokenHash);
      const resetToken = tokenId ? passwordResetTokens.get(tokenId) : null;
      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
        return null;
      }
      const user = users.get(resetToken.userId);
      resetToken.usedAt = now;
      user.passwordHash = passwordHash;
      user.updatedAt = now;
      await auth.revokeAllRefreshTokensForUser({
        userId: user.id,
        revokedAt: now,
      });
      return user;
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
