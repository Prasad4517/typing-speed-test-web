import { setTimeout as delay } from 'node:timers/promises';

import { config } from '../config/env.js';
import { createPrismaClient } from '../plugins/prisma.js';
import { createOutboxRepository } from '../repositories/outbox.repository.js';
import { createWebhookEmailDelivery } from '../services/email-delivery.service.js';
import { createOutboxCryptoService } from '../services/outbox-crypto.service.js';
import { createOutboxWorker } from '../services/outbox-worker.service.js';

const prisma = createPrismaClient();
const worker = createOutboxWorker({
  repository: createOutboxRepository(prisma),
  outboxCrypto: createOutboxCryptoService(config.outboxEncryptionKey),
  emailDelivery: createWebhookEmailDelivery({
    url: config.mailWebhookUrl,
    bearerToken: config.mailWebhookBearerToken,
  }),
  frontendUrl: config.frontendPublicUrl,
});

let stopping = false;
process.once('SIGINT', () => {
  stopping = true;
});
process.once('SIGTERM', () => {
  stopping = true;
});

try {
  while (!stopping) {
    const result = await worker.processBatch();
    if (!result.claimed) {
      await delay(config.outboxPollIntervalMs);
    }
  }
} finally {
  await prisma.$disconnect();
}
