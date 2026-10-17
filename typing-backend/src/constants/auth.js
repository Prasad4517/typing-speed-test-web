export const USER_ROLES = Object.freeze({
  user: 'USER',
  admin: 'ADMIN',
});

export const AUTH = Object.freeze({
  accessTokenAlgorithm: 'HS256',
  accessCookieName: 'keystroke_access',
  refreshCookieName: 'keystroke_refresh',
  accessCookiePath: '/api',
  refreshCookiePath: '/api/auth',
  sameSite: 'lax',
  passwordHashing: Object.freeze({
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  }),
  refreshTokenBytes: 48,
  passwordResetTokenBytes: 48,
});
