import { z } from 'zod';

import { DIFFICULTY_VALUES } from '../constants/difficulty.js';
import { HEADERS } from '../constants/headers.js';
import { TEST_MODE_VALUES } from '../constants/test-modes.js';

export const difficultySchema = z.enum(DIFFICULTY_VALUES);
export const modeSchema = z.enum(TEST_MODE_VALUES);

export const clientIdSchema = z
  .string()
  .uuid()
  .refine((value) => value.split('-')[2]?.startsWith('4'), {
    message: 'X-Client-Id must be a UUID v4.',
  });

export const clientHeadersSchema = z.object({
  [HEADERS.clientId]: clientIdSchema,
});
