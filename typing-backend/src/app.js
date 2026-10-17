import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';

import { config } from './config/env.js';
import { HEADERS } from './constants/headers.js';
import { LIMITS } from './constants/limits.js';
import { createHealthService } from './services/health.service.js';
import { createAuthService } from './services/auth.service.js';
import { createPassagesService } from './services/passages.service.js';
import { createStatsService } from './services/stats.service.js';
import { createTestsService } from './services/tests.service.js';
import { createWordsService } from './services/words.service.js';
import { createHealthController } from './controllers/health.controller.js';
import { createAuthController } from './controllers/auth.controller.js';
import { createPassagesController } from './controllers/passages.controller.js';
import { createStatsController } from './controllers/stats.controller.js';
import { createTestsController } from './controllers/tests.controller.js';
import { createWordsController } from './controllers/words.controller.js';
import registerCors from './plugins/cors.js';
import registerCookies from './plugins/cookies.js';
import registerErrorHandler from './plugins/error-handler.js';
import { createPrismaClient, registerPrisma } from './plugins/prisma.js';
import registerRateLimit from './plugins/rate-limit.js';
import { createRepositories } from './repositories/index.js';
import routes from './routes/index.js';

export function buildApp({
  repositories: providedRepositories,
  prisma: providedPrisma,
  readyCheck,
  now,
  passwordResetDelivery,
} = {}) {
  const prisma =
    providedPrisma || (providedRepositories ? null : createPrismaClient());
  const repositories = providedRepositories || createRepositories({ prisma });
  const checkDatabase =
    readyCheck || (prisma ? () => prisma.$queryRaw`SELECT 1` : async () => {});
  const services = {
    auth: createAuthService({
      repository: repositories.auth,
      config,
      now,
      sendPasswordReset: passwordResetDelivery,
    }),
    health: createHealthService({ readyCheck: checkDatabase }),
    passages: createPassagesService({ repository: repositories.passages }),
    words: createWordsService({ repository: repositories.words }),
    stats: createStatsService({ repository: repositories.testSessions }),
  };
  services.tests = createTestsService({
    repository: repositories.testSessions,
    passagesService: services.passages,
    wordsService: services.words,
    config,
    now,
  });
  const controllers = {
    auth: createAuthController({ service: services.auth }),
    health: createHealthController({ service: services.health }),
    passages: createPassagesController({ service: services.passages }),
    words: createWordsController({ service: services.words }),
    tests: createTestsController({ service: services.tests }),
    stats: createStatsController({ service: services.stats }),
  };

  const app = Fastify({
    bodyLimit: LIMITS.bodySizeBytes,
    trustProxy: config.trustProxy,
    requestIdHeader: HEADERS.requestId,
    genReqId: () => randomUUID(),
    logger:
      config.isProduction === false
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard' },
            },
          }
        : true,
  });

  if (prisma) registerPrisma(app, prisma);
  registerErrorHandler(app);
  app.addHook('onSend', async (request, reply) => {
    reply.header(HEADERS.requestId, request.id);
  });
  app.register(registerCookies);
  app.register(registerCors);
  app.register(helmet);
  app.register(registerRateLimit);
  app.register(routes, { prefix: '/api', controllers });

  return app;
}
