export function createSecurityCleanupRepository(prisma) {
  return Object.freeze({
    async prune({ securityCutoff, auditCutoff, outboxCutoff, batchSize }) {
      const [
        refreshTokens,
        verificationTokens,
        resetTokens,
        sessions,
        audits,
        outbox,
      ] = await prisma.$transaction([
        prisma.$executeRaw`
          DELETE FROM \`RefreshToken\`
          WHERE \`expiresAt\` < ${securityCutoff}
          ORDER BY \`expiresAt\` ASC
          LIMIT ${batchSize}
          `,
        prisma.$executeRaw`
          DELETE FROM \`EmailVerificationToken\`
          WHERE \`expiresAt\` < ${securityCutoff}
          ORDER BY \`expiresAt\` ASC
          LIMIT ${batchSize}
          `,
        prisma.$executeRaw`
          DELETE FROM \`PasswordResetToken\`
          WHERE \`expiresAt\` < ${securityCutoff}
          ORDER BY \`expiresAt\` ASC
          LIMIT ${batchSize}
          `,
        prisma.$executeRaw`
          DELETE FROM \`Session\`
          WHERE \`expiresAt\` < ${securityCutoff}
             OR \`revokedAt\` < ${securityCutoff}
          ORDER BY \`expiresAt\` ASC
          LIMIT ${batchSize}
          `,
        prisma.$executeRaw`
          DELETE FROM \`SecurityAuditEvent\`
          WHERE \`createdAt\` < ${auditCutoff}
          ORDER BY \`createdAt\` ASC
          LIMIT ${batchSize}
          `,
        prisma.$executeRaw`
          DELETE FROM \`NotificationOutbox\`
          WHERE \`status\` IN ('SENT', 'FAILED')
            AND \`updatedAt\` < ${outboxCutoff}
          ORDER BY \`updatedAt\` ASC
          LIMIT ${batchSize}
          `,
      ]);
      return {
        refreshTokens,
        verificationTokens,
        resetTokens,
        sessions,
        audits,
        outbox,
      };
    },
  });
}
