export const MESSAGES = Object.freeze({
  rateLimited: 'Too many requests. Please try again later.',
  testNotFound: 'Test session not found.',
  alreadySubmitted: 'Test session has already been submitted.',
  alreadyRejected: 'Test session has already been rejected.',
  unverifiableElapsed: 'The submitted elapsed time could not be verified.',
  elapsedTooLong: 'The submitted elapsed time exceeds the test duration.',
  textTooLong: 'The submitted text is longer than the test text allows.',
  elapsedTooShort: 'The submitted elapsed time is too short.',
  speedUnverifiable: 'The submitted speed could not be verified.',
  invalidCredentials: 'Invalid email or password.',
  unauthorized: 'Authentication is required.',
  invalidSession:
    'Your session is invalid or has expired. Please sign in again.',
  emailAlreadyRegistered: 'An account with this email already exists.',
  forbiddenOrigin: 'This request origin is not allowed.',
  passwordResetRequested:
    'If an account exists for this email, password reset instructions will be sent.',
  invalidPasswordReset: 'This password reset link is invalid or has expired.',
});
