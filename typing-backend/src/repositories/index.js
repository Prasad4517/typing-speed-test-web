import { createAuthRepository } from './auth.repository.js';
import { createPassagesRepository } from './passages.repository.js';
import { createTestSessionsRepository } from './test-sessions.repository.js';
import { createWordsRepository } from './words.repository.js';

export function createRepositories({ prisma }) {
  return {
    auth: createAuthRepository(prisma),
    passages: createPassagesRepository(),
    words: createWordsRepository(),
    testSessions: createTestSessionsRepository(prisma),
  };
}
