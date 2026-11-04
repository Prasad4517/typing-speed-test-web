export const USER_ROLES = Object.freeze({
  user: 'ROLE_USER',
  admin: 'ROLE_ADMIN',
});

export const USER_STATUSES = Object.freeze({
  pending: 'PENDING_VERIFICATION',
  active: 'ACTIVE',
  locked: 'LOCKED',
  disabled: 'DISABLED',
  deleted: 'DELETED',
});

export const TOKEN_STATUSES = Object.freeze({
  active: 'ACTIVE',
  rotated: 'ROTATED',
  revoked: 'REVOKED',
});

export const AUTH = Object.freeze({
  accessTokenAlgorithm: 'PS256',
  accessTokenType: 'at+jwt',
  accessTokenUse: 'access',
  refreshCookieName: 'keystroke_refresh',
  csrfCookieName: 'keystroke_csrf',
  refreshCookiePath: '/api/v1/auth',
  csrfCookiePath: '/api/v1',
  csrfHeaderName: 'x-csrf-token',
  sameSite: 'lax',
  passwordHashing: Object.freeze({
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  }),
  refreshTokenBytes: 48,
  verificationTokenBytes: 32,
  passwordResetTokenBytes: 48,
  csrfNonceBytes: 32,
  sessionRevocationReasons: Object.freeze({
    logout: 'LOGOUT',
    logoutAll: 'LOGOUT_ALL',
    refreshReuse: 'REFRESH_TOKEN_REUSE',
    passwordChanged: 'PASSWORD_CHANGED',
    passwordReset: 'PASSWORD_RESET',
    userRevoked: 'USER_REVOKED',
  }),
});
