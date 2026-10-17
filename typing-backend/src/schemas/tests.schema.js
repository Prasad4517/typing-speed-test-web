import { z } from 'zod';

import { LIMITS } from '../constants/limits.js';
import { TEST_MODES } from '../constants/test-modes.js';
import { difficultySchema, modeSchema } from './common.schema.js';

const passageStartSchema = z
  .object({
    mode: z.literal(TEST_MODES.passage),
    difficulty: difficultySchema.optional(),
    exclude: z
      .array(z.string().min(1).max(64))
      .max(LIMITS.maxPassageExclude)
      .default([]),
  })
  .strict();

const timedStartSchema = z
  .object({
    mode: z.literal(TEST_MODES.timed),
    duration: z.union([
      z.literal(15),
      z.literal(30),
      z.literal(60),
      z.literal(120),
    ]),
  })
  .strict();

export const startTestBodySchema = z.discriminatedUnion('mode', [
  passageStartSchema,
  timedStartSchema,
]);

export const testIdParamsSchema = z.object({
  testId: z.string().uuid(),
});

export const submitTestBodySchema = z
  .object({
    typedText: z.string().max(LIMITS.maxSubmitTextLength),
    elapsedMs: z.coerce.number().int().nonnegative().max(LIMITS.maxElapsedMs),
  })
  .strict();

export const testHistoryQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LIMITS.maxHistoryLimit)
      .default(LIMITS.defaultHistoryLimit),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export { modeSchema };
