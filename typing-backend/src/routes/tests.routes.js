import { clientHeadersSchema } from '../schemas/client.schema.js';
import { LIMITS } from '../constants/limits.js';
import {
  startTestBodySchema,
  submitTestBodySchema,
  testHistoryQuerySchema,
  testIdParamsSchema,
} from '../schemas/tests.schema.js';
import {
  validateBody,
  validateHeaders,
  validateParams,
  validateQuery,
} from '../utils/validate.js';

async function validateClient(request) {
  validateHeaders(request, clientHeadersSchema);
}

export default async function testsRoutes(app, { controllers }) {
  app.post('/tests/start', {
    config: {
      rateLimit: {
        max: LIMITS.testStartRateLimit,
        timeWindow: LIMITS.rateLimitWindow,
      },
    },
    preHandler: [
      validateClient,
      async (request) => {
        request.body = validateBody(request, startTestBodySchema);
      },
    ],
    handler: controllers.tests.start,
  });

  app.post('/tests/:testId/submit', {
    config: {
      rateLimit: {
        max: LIMITS.testSubmitRateLimit,
        timeWindow: LIMITS.rateLimitWindow,
      },
    },
    preHandler: [
      validateClient,
      async (request) => {
        request.params = validateParams(request, testIdParamsSchema);
        request.body = validateBody(request, submitTestBodySchema);
      },
    ],
    handler: controllers.tests.submit,
  });

  app.get('/tests/history', {
    preHandler: [
      validateClient,
      async (request) => {
        request.query = validateQuery(request, testHistoryQuerySchema);
      },
    ],
    handler: controllers.stats.history,
  });
}
