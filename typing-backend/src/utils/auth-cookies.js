import { AUTH } from '../constants/auth.js';
import { config } from '../config/env.js';

function options({ path, maxAge }) {
  return {
    httpOnly: true,
    maxAge,
    path,
    sameSite: AUTH.sameSite,
    secure: config.authCookieSecure,
  };
}

export function setAuthCookies(reply, tokens) {
  reply.setCookie(
    AUTH.accessCookieName,
    tokens.accessToken,
    options({
      path: AUTH.accessCookiePath,
      maxAge: config.accessTokenTtlSeconds,
    }),
  );
  reply.setCookie(
    AUTH.refreshCookieName,
    tokens.refreshToken,
    options({
      path: AUTH.refreshCookiePath,
      maxAge: config.refreshTokenTtlDays * 24 * 60 * 60,
    }),
  );
}

export function clearAuthCookies(reply) {
  reply.clearCookie(
    AUTH.accessCookieName,
    options({ path: AUTH.accessCookiePath }),
  );
  reply.clearCookie(
    AUTH.refreshCookieName,
    options({ path: AUTH.refreshCookiePath }),
  );
}
