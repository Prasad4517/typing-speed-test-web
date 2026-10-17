export function createTestsController({ service }) {
  return {
    start: async (request) =>
      service.start({
        clientId: request.headers['x-client-id'],
        ...request.body,
      }),
    submit: async (request) =>
      service.submit({
        clientId: request.headers['x-client-id'],
        testId: request.params.testId,
        ...request.body,
      }),
  };
}
