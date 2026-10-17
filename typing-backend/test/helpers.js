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
