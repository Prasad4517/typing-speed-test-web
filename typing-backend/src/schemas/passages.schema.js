import { z } from 'zod';

import { difficultySchema } from './common.schema.js';

export const randomPassageQuerySchema = z
  .object({
    difficulty: difficultySchema.optional(),
    exclude: z
      .string()
      .optional()
      .transform((value) => (value ? value.split(',').filter(Boolean) : [])),
  })
  .strict();
