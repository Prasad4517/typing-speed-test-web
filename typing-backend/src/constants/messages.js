export const MESSAGES = Object.freeze({
  rateLimited: 'Too many requests. Please try again later.',
  dependencyUnavailable:
    'A required security service is temporarily unavailable.',
  testNotFound: 'Test session not found.',
  alreadySubmitted: 'Test session has already been submitted.',
  alreadyRejected: 'Test session has already been rejected.',
  unverifiableElapsed: 'The submitted elapsed time could not be verified.',
  elapsedTooLong: 'The submitted elapsed time exceeds the test duration.',
  textTooLong: 'The submitted text is longer than the test text allows.',
  elapsedTooShort: 'The submitted elapsed time is too short.',
  speedUnverifiable: 'The submitted speed could not be verified.',
  invalidCredentials: 'Invalid credentials.',
  unauthorized: 'Authentication is required.',
  invalidSession:
    'Your session is invalid or has expired. Please sign in again.',
  refreshReuse: 'Session reuse was detected. Please sign in again.',
  emailAlreadyRegistered: 'An account with this email already exists.',
  emailNotVerified: 'Verify your email before signing in.',
  accountLocked: 'This account is temporarily locked. Try again later.',
  accountUnavailable: 'This account cannot sign in.',
  forbiddenOrigin: 'This request origin is not allowed.',
  invalidCsrf: 'The security proof is missing or invalid.',
  passwordResetRequested:
    'If an eligible account exists, password reset instructions will be sent.',
  verificationRequested:
    'If an eligible account exists, verification instructions will be sent.',
  invalidPasswordReset: 'This password reset link is invalid or has expired.',
  invalidVerification: 'This verification token is invalid or has expired.',
  weakPassword: 'Choose a less common password.',
});
