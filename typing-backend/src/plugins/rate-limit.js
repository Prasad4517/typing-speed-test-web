import rateLimit from '@fastify/rate-limit';

import { config } from '../config/env.js';
import { ERROR_CODES } from '../constants/error-codes.js';
import { MESSAGES } from '../constants/messages.js';

export default async function registerRateLimit(app) {
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    errorResponseBuilder: () => ({
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: MESSAGES.rateLimited,
        details: [],
      },
    }),
  });
}
