export function createOutboxRepository(prisma) {
  return Object.freeze({
    async claimBatch({ now, leaseUntil, limit }) {
      return prisma.$transaction(async (transaction) => {
        await transaction.notificationOutbox.updateMany({
          where: {
            status: 'PROCESSING',
            attempts: { gte: 5 },
            availableAt: { lte: now },
          },
          data: { status: 'FAILED', lastError: 'DELIVERY_LEASE_EXPIRED' },
        });
        const rows = await transaction.$queryRaw`
          SELECT \`id\`
          FROM \`NotificationOutbox\`
          WHERE (
            (\`status\` IN ('PENDING', 'FAILED') AND \`availableAt\` <= ${now})
            OR (\`status\` = 'PROCESSING' AND \`availableAt\` <= ${now})
          )
          AND \`attempts\` < 5
          ORDER BY \`createdAt\` ASC
          LIMIT ${limit}
          FOR UPDATE
        `;
        const ids = rows.map((row) => row.id);
        if (!ids.length) return [];
        await transaction.notificationOutbox.updateMany({
          where: { id: { in: ids } },
          data: {
            status: 'PROCESSING',
            attempts: { increment: 1 },
            availableAt: leaseUntil,
          },
        });
        return transaction.notificationOutbox.findMany({
          where: { id: { in: ids } },
          orderBy: { createdAt: 'asc' },
        });
      });
    },

    markSent({ id, processedAt }) {
      return prisma.notificationOutbox.updateMany({
        where: { id, status: 'PROCESSING' },
        data: {
          status: 'SENT',
          processedAt,
          lastError: null,
        },
      });
    },

    markFailed({ id, availableAt, terminal }) {
      return prisma.notificationOutbox.updateMany({
        where: { id, status: 'PROCESSING' },
        data: {
          status: terminal ? 'FAILED' : 'PENDING',
          availableAt,
          lastError: 'DELIVERY_FAILED',
        },
      });
    },
  });
}
