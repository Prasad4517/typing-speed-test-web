import { config } from '../config/env.js';
import { createPrismaClient } from '../plugins/prisma.js';
import { createSecurityCleanupRepository } from '../repositories/security-cleanup.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const prisma = createPrismaClient();
const repository = createSecurityCleanupRepository(prisma);

try {
  const result = await repository.prune({
    securityCutoff: new Date(
      now.getTime() - config.securityRetentionDays * DAY_MS,
    ),
    auditCutoff: new Date(now.getTime() - config.auditRetentionDays * DAY_MS),
    outboxCutoff: new Date(now.getTime() - config.outboxRetentionDays * DAY_MS),
    batchSize: config.cleanupBatchSize,
  });
  console.log('Security cleanup completed.', result);
} finally {
  await prisma.$disconnect();
}
