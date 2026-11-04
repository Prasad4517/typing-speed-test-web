import { ROUTES } from '@/constants/routes';

const RETURN_ORIGIN = 'https://keystroke.local';
const AUTH_PATHS = new Set([
  ROUTES.signIn,
  ROUTES.signUp,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.verifyEmail,
]);

export function safeReturnPath(value, fallback = ROUTES.dashboard) {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(decoded);
    decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }

  if (
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(decoded)
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, RETURN_ORIGIN);
    if (url.origin !== RETURN_ORIGIN || AUTH_PATHS.has(url.pathname)) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
