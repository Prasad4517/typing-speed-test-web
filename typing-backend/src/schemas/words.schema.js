import { z } from 'zod';

import { LIMITS } from '../constants/limits.js';

export const wordsQuerySchema = z
  .object({
    count: z.coerce.number().int().min(1).max(LIMITS.maxWords).default(50),
    language: z.string().length(2).default('en'),
  })
  .strict();
