export const LIMITS = Object.freeze({
  bodySizeBytes: 64 * 1024,
  defaultHistoryLimit: 20,
  maxHistoryLimit: 50,
  maxSubmitTextLength: 10000,
  maxElapsedMs: 86400000,
  maxPassageExclude: 100,
  maxWords: 1000,
  testStartRateLimit: 20,
  testSubmitRateLimit: 30,
  rateLimitWindow: '1 minute',
});
