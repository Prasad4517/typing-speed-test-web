import { config } from '../config/env.js';
import { AUTH } from '../constants/auth.js';
import { HEADERS } from '../constants/headers.js';
import { MESSAGES } from '../constants/messages.js';
import { ForbiddenError } from './app-error.js';

/**
 * Every browser state-changing request must originate from an explicitly
 * allowed UI. Non-browser tools can still exercise read-only health APIs;
 * unsafe cookie-participating routes intentionally require an Origin.
 */
export async function validateStateChangingOrigin(request) {
  const origin = request.headers[HEADERS.origin];
  const fetchSite = request.headers[HEADERS.fetchSite];

  if (fetchSite === 'cross-site') {
    throw new ForbiddenError(MESSAGES.forbiddenOrigin);
  }
  if (origin && config.corsOrigins.includes(origin)) return;

  throw new ForbiddenError(MESSAGES.forbiddenOrigin);
}

export async function validateCsrfBootstrapOrigin(request) {
  const origin = request.headers[HEADERS.origin];
  const fetchSite = request.headers[HEADERS.fetchSite];
  if (origin) return validateStateChangingOrigin(request);
  if (!fetchSite || ['same-origin', 'none'].includes(fetchSite)) return;
  throw new ForbiddenError(MESSAGES.forbiddenOrigin);
}

export function createValidateCsrf(csrfService) {
  return async function validateCsrf(request) {
    request.csrf = csrfService.verify({
      headerToken: request.headers[HEADERS.csrf],
      cookieToken: request.cookies?.[AUTH.csrfCookieName],
    });
  };
}

export function createValidateLogoutCsrf(csrfService) {
  const validateCsrf = createValidateCsrf(csrfService);
  return async function validateLogoutCsrf(request) {
    if (!request.cookies?.[AUTH.refreshCookieName]) return;
    await validateCsrf(request);
  };
}
