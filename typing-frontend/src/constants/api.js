export const API = Object.freeze({
  basePath: '/api',
  endpoints: Object.freeze({
    health: '/health',
    startTest: '/tests/start',
    submitTest: (id) => `/tests/${encodeURIComponent(id)}/submit`,
    history: '/tests/history',
    summary: '/stats/summary',
    randomPassage: '/passages/random',
    words: '/words',
  }),
  headers: Object.freeze({
    clientId: 'X-Client-Id',
    requestId: 'X-Request-Id',
  }),
  requestTimeoutMs: 10000,
  errorCodes: Object.freeze({
    validation: 'VALIDATION_ERROR',
    notFound: 'NOT_FOUND',
    conflict: 'CONFLICT',
    rateLimited: 'RATE_LIMITED',
    internal: 'INTERNAL_ERROR',
  }),
});
