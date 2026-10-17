import { createPassagesRepository } from './passages.repository.js';
import { createTestSessionsRepository } from './test-sessions.repository.js';
import { createWordsRepository } from './words.repository.js';

export function createRepositories({ prisma }) {
  return {
    passages: createPassagesRepository(),
    words: createWordsRepository(),
    testSessions: createTestSessionsRepository(prisma),
  };
}
