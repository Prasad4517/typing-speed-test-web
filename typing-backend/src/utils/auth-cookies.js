import { AUTH } from '../constants/auth.js';
import { config } from '../config/env.js';

function options({ path, maxAge, httpOnly }) {
  return {
    httpOnly,
    maxAge,
    path,
    sameSite: config.authCookieSameSite,
    secure: config.authCookieSecure,
    ...(config.authCookieDomain ? { domain: config.authCookieDomain } : {}),
  };
}

export function setRefreshCookie(reply, refreshToken) {
  reply.setCookie(
    AUTH.refreshCookieName,
    refreshToken,
    options({
      path: AUTH.refreshCookiePath,
      maxAge: config.refreshTokenTtlDays * 24 * 60 * 60,
      httpOnly: true,
    }),
  );
}

export function setCsrfCookie(reply, csrfToken) {
  reply.setCookie(
    AUTH.csrfCookieName,
    csrfToken,
    options({
      path: AUTH.csrfCookiePath,
      maxAge: config.refreshTokenTtlDays * 24 * 60 * 60,
      httpOnly: false,
    }),
  );
}

export function clearAuthCookies(reply) {
  reply.clearCookie(
    AUTH.refreshCookieName,
    options({ path: AUTH.refreshCookiePath, httpOnly: true }),
  );
  reply.clearCookie(
    AUTH.csrfCookieName,
    options({ path: AUTH.csrfCookiePath, httpOnly: false }),
  );
}
