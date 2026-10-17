import { NotFoundError } from '../utils/app-error.js';

export function createPassagesService({ repository }) {
  return Object.freeze({
    getRandomPassage({ difficulty, exclude = [] } = {}) {
      const count = repository.count({ difficulty, exclude });
      if (!count) {
        throw new NotFoundError('No passage matched the requested filters.');
      }

      const passage = repository.getRandom({ difficulty, exclude });
      if (!passage)
        throw new NotFoundError('No passage matched the requested filters.');
      return passage;
    },
  });
}
