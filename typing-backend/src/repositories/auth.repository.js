export function createAuthRepository(prisma) {
  return Object.freeze({
    findUserByEmail: (email) => prisma.user.findUnique({ where: { email } }),

    findUserById: (id) => prisma.user.findUnique({ where: { id } }),

    createUser: (data) => prisma.user.create({ data }),

    updateUserProfile: async ({ userId, fullName }) => {
      const updated = await prisma.user.updateMany({
        where: { id: userId },
        data: { fullName },
      });
      if (!updated.count) return null;
      return prisma.user.findUnique({ where: { id: userId } });
    },

    findRefreshTokenByHash: (tokenHash) =>
      prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      }),

    createRefreshToken: (data) => prisma.refreshToken.create({ data }),

    rotateRefreshToken: async ({ tokenId, familyId, revokedAt, replacement }) =>
      prisma.$transaction(async (transaction) => {
        const invalidated = await transaction.refreshToken.updateMany({
          where: {
            id: tokenId,
            familyId,
            revokedAt: null,
            expiresAt: { gt: revokedAt },
          },
          data: {
            revokedAt,
            replacedByTokenId: replacement.id,
          },
        });

        if (!invalidated.count) return null;
        return transaction.refreshToken.create({ data: replacement });
      }),

    revokeRefreshTokenByHash: ({ tokenHash, revokedAt }) =>
      prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt },
      }),

    revokeRefreshTokenFamily: ({ familyId, revokedAt }) =>
      prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt },
      }),

    revokeAllRefreshTokensForUser: ({ userId, revokedAt }) =>
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt },
      }),

    issuePasswordResetToken: async ({ userId, tokenHash, expiresAt, now }) =>
      prisma.$transaction(async (transaction) => {
        await transaction.passwordResetToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: now },
        });
        return transaction.passwordResetToken.create({
          data: { userId, tokenHash, expiresAt },
        });
      }),

    resetPasswordWithToken: async ({ tokenHash, passwordHash, now }) =>
      prisma.$transaction(async (transaction) => {
        const resetToken = await transaction.passwordResetToken.findUnique({
          where: { tokenHash },
        });

        if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
          return null;
        }

        const consumed = await transaction.passwordResetToken.updateMany({
          where: {
            id: resetToken.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (!consumed.count) return null;

        const user = await transaction.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        });
        await transaction.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
        return user;
      }),
  });
}
