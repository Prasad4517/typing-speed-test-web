import { ValidationError } from '../utils/app-error.js';

export function createWordsService({ repository }) {
  return Object.freeze({
    getWords({ count = 50, language = 'en' }) {
      if (language !== 'en') {
        throw new ValidationError('Only the English word list is available.');
      }

      return { words: repository.getRandomWords(count) };
    },
  });
}
