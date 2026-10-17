export function createStatsController({ service }) {
  return {
    history: async (request) =>
      service.history({
        clientId: request.headers['x-client-id'],
        ...request.query,
      }),
    summary: async (request) =>
      service.summary({ clientId: request.headers['x-client-id'] }),
  };
}
