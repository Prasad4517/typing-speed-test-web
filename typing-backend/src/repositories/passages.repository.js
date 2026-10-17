import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';

import { z } from 'zod';

import { difficultySchema } from '../schemas/common.schema.js';

const passageInputSchema = z.object({
  key: z.string().min(1),
  text: z.string().trim().min(1),
  difficulty: difficultySchema,
  category: z.string().trim().min(1),
});

function loadPassages(source) {
  const parsed = z.array(passageInputSchema).safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid passages data: ${JSON.stringify(parsed.error.issues)}`,
    );
  }

  const keys = new Set();
  return parsed.data.map((passage) => {
    if (keys.has(passage.key)) {
      throw new Error(`Invalid passages data: duplicate key ${passage.key}.`);
    }

    keys.add(passage.key);
    const wordCount = passage.text.split(/\s+/).length;

    if (wordCount < 30 || wordCount > 120) {
      throw new Error(
        `Invalid passages data: ${passage.key} must contain between 30 and 120 words.`,
      );
    }

    return {
      ...passage,
      wordCount,
      charCount: passage.text.length,
    };
  });
}

function loadDefaultPassages() {
  const filePath = fileURLToPath(
    new URL('../data/passages.seed.json', import.meta.url),
  );
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * File-backed repository. Its small interface is intentionally compatible
 * with a future Prisma-backed repository, so services do not change when
 * passages move into the database.
 */
export function createPassagesRepository({
  source = loadDefaultPassages(),
} = {}) {
  const passages = loadPassages(source);

  return Object.freeze({
    count: ({ difficulty, exclude = [] } = {}) =>
      passages.filter(
        (passage) =>
          (!difficulty || passage.difficulty === difficulty) &&
          !exclude.includes(passage.key),
      ).length,
    getByIndex: ({ difficulty, exclude = [], index }) =>
      passages.filter(
        (passage) =>
          (!difficulty || passage.difficulty === difficulty) &&
          !exclude.includes(passage.key),
      )[index] || null,
    getByKey: (key) => passages.find((passage) => passage.key === key) || null,
    getRandom: ({ difficulty, exclude = [] } = {}) => {
      const matches = passages.filter(
        (passage) =>
          (!difficulty || passage.difficulty === difficulty) &&
          !exclude.includes(passage.key),
      );

      return matches.length ? matches[randomInt(matches.length)] : null;
    },
  });
}
