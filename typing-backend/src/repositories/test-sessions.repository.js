export function createTestSessionsRepository(prisma) {
  return Object.freeze({
    create: (data) => prisma.testSession.create({ data }),
    findById: (id) => prisma.testSession.findUnique({ where: { id } }),
    claimSubmission: ({ id, clientId, data }) =>
      prisma.testSession.updateMany({
        where: { id, clientId, status: 'STARTED' },
        data,
      }),
    markRejected: ({ id, clientId, reason }) =>
      prisma.testSession.updateMany({
        where: { id, clientId, status: 'STARTED' },
        data: { status: 'REJECTED', rejectReason: reason },
      }),
    findSubmitted: ({ clientId, limit, cursor }) => {
      const cursorDate = cursor ? new Date(cursor.createdAt) : null;
      return prisma.testSession.findMany({
        where: {
          clientId,
          status: 'SUBMITTED',
          ...(cursorDate
            ? {
                OR: [
                  { createdAt: { lt: cursorDate } },
                  { createdAt: cursorDate, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
    },
    aggregateSubmitted: ({ clientId }) =>
      prisma.testSession.aggregate({
        where: { clientId, status: 'SUBMITTED' },
        _count: { _all: true },
        _avg: { wpm: true, accuracy: true },
      }),
    bestSubmitted: ({ clientId }) =>
      prisma.testSession.aggregate({
        where: { clientId, status: 'SUBMITTED' },
        _max: { wpm: true },
      }),
    groupByMode: ({ clientId }) =>
      prisma.testSession.groupBy({
        by: ['mode'],
        where: { clientId, status: 'SUBMITTED' },
        _count: { _all: true },
        _avg: { wpm: true, accuracy: true },
      }),
  });
}
