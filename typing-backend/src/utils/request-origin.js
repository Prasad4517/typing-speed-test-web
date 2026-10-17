import { config } from '../config/env.js';
import { HEADERS } from '../constants/headers.js';
import { MESSAGES } from '../constants/messages.js';
import { ForbiddenError } from './app-error.js';

/**
 * Cookie-authenticated browser requests must originate from an allowed UI.
 * Development permits origin-less requests so local curl/API tests remain
 * usable; browsers always send Origin for cross-origin unsafe methods.
 */
export async function validateStateChangingOrigin(request) {
  const origin = request.headers[HEADERS.origin];

  if (!origin && !config.isProduction) return;
  if (origin && config.corsOrigins.includes(origin)) return;

  throw new ForbiddenError(MESSAGES.forbiddenOrigin);
}
