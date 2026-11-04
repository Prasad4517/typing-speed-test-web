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
import { createAccessTokenService } from './services/access-token.service.js';
import { createCsrfService } from './services/csrf.service.js';
import { createOutboxCryptoService } from './services/outbox-crypto.service.js';
import { createPasswordService } from './services/password.service.js';
import {
  createMemoryRateLimiter,
  createRedisRateLimiter,
} from './services/rate-limiter.service.js';
import { createSigningKeyProvider } from './services/signing-key-provider.js';
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
  rateLimiter: providedRateLimiter,
  keyProvider: providedKeyProvider,
} = {}) {
  const prisma =
    providedPrisma || (providedRepositories ? null : createPrismaClient());
  const repositories = providedRepositories || createRepositories({ prisma });
  const checkDatabase =
    readyCheck || (prisma ? () => prisma.$queryRaw`SELECT 1` : async () => {});
  const rateLimiter =
    providedRateLimiter ||
    (providedRepositories
      ? createMemoryRateLimiter()
      : createRedisRateLimiter({
          url: config.redisUrl,
          onError: (error) => {
            if (config.isProduction)
              console.error('Redis security service error.', error);
          },
        }));
  const keyProvider = providedKeyProvider || createSigningKeyProvider(config);
  const csrfService = createCsrfService({
    secret: config.csrfSigningSecret,
    now: now || (() => new Date()),
  });
  const services = {
    auth: createAuthService({
      repository: repositories.auth,
      config,
      now,
      accessTokenService: createAccessTokenService({
        config,
        keyProvider,
        now: now || (() => new Date()),
      }),
      passwordService: createPasswordService(config),
      csrfService,
      outboxCrypto: createOutboxCryptoService(config.outboxEncryptionKey),
      rateLimiter,
    }),
    health: createHealthService({
      readyCheck: async () => {
        await checkDatabase();
        await rateLimiter.checkAvailability();
      },
    }),
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
    genReqId: () => randomUUID(),
    logger: config.isTest
      ? false
      : config.isProduction === false
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'SYS:standard' },
            },
          }
        : {
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers.set-cookie',
            ],
          },
  });

  if (prisma) registerPrisma(app, prisma);
  registerErrorHandler(app);
  app.addHook('onSend', async (request, reply) => {
    reply.header(HEADERS.requestId, request.id);
    if (
      request.url.startsWith('/api/v1/auth') ||
      request.url.startsWith('/api/v1/account') ||
      request.url.startsWith('/api/v1/user') ||
      request.url.startsWith('/api/v1/admin')
    ) {
      reply.header('Cache-Control', 'no-store');
      reply.header('Pragma', 'no-cache');
    }
  });
  app.addHook('onReady', async () => {
    // Authentication remains fail-closed until Redis is ready, but a transient
    // Redis outage must not suppress the public liveness endpoint. Readiness
    // and every sensitive limiter check still report the dependency failure.
    void rateLimiter.start().catch(() => {
      app.log.warn(
        'Redis rate limiter is unavailable; sensitive authentication operations will fail closed.',
      );
    });
  });
  app.addHook('onClose', async () => {
    await rateLimiter.close();
  });
  app.register(registerCookies);
  app.register(registerCors);
  app.register(helmet);
  app.register(registerRateLimit);
  app.register(routes, {
    prefix: '/api/v1',
    controllers,
    csrfService,
  });

  return app;
}
