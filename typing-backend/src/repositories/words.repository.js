import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';

import { z } from 'zod';

const wordsSchema = z.array(z.string().regex(/^[a-z]+$/)).min(500);

function loadDefaultWords() {
  const filePath = fileURLToPath(
    new URL('../data/words.en.json', import.meta.url),
  );
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function createWordsRepository({ source = loadDefaultWords() } = {}) {
  const parsed = wordsSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid English words data: ${JSON.stringify(parsed.error.issues)}`,
    );
  }

  const words = parsed.data;
  if (new Set(words).size !== words.length) {
    throw new Error(
      'Invalid English words data: duplicate words are not allowed.',
    );
  }

  return Object.freeze({
    getRandomWords: (count) =>
      Array.from(
        { length: count },
        () => words[Math.floor(Math.random() * words.length)],
      ),
    getCount: () => words.length,
  });
}
