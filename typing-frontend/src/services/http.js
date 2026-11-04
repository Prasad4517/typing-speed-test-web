import { API } from '@/constants/api';
import { MESSAGES } from '@/constants/messages';
import { getClientId } from '@/lib/client-id';

import {
  clearAccessSession,
  getAccessToken,
  getCsrfToken,
  invalidateCsrfToken,
  refreshAccessSession,
} from './auth-client';

export class ApiError extends Error {
  constructor({ code, message, status, details = [] }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function apiUrl(path) {
  if (path.startsWith(`${API.basePath}/`) || path === API.basePath) return path;
  return `${API.basePath}${path.startsWith('/') ? path : `/${path}`}`;
}

function isUnsafeMethod(method) {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function isFormData(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error?.status !== undefined) {
    return new ApiError({
      code: error.code || 'HTTP_ERROR',
      message: error.message || 'The request failed.',
      status: error.status,
      details: error.details || [],
    });
  }
  return error;
}

function responseError(response, payload) {
  return new ApiError({
    code: payload?.error?.code || 'HTTP_ERROR',
    message: payload?.error?.message || 'The request failed.',
    status: response.status,
    details: payload?.error?.details || [],
  });
}

function isCsrfError(error) {
  return (
    error.status === 403 &&
    typeof error.code === 'string' &&
    error.code.toUpperCase().includes('CSRF')
  );
}

function isRefreshableAuthError(error) {
  return (
    error.status === 401 &&
    [API.errorCodes.unauthorized, API.errorCodes.invalidSession].includes(
      error.code,
    )
  );
}

async function parsePayload(response) {
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function execute(path, options, attempt) {
  const { method, body, timeoutMs, headers, auth, authToken, csrf, retryAuth } =
    options;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = { Accept: 'application/json', ...headers };
  const clientId = getClientId();

  if (body !== undefined && !isFormData(body)) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  if (clientId) requestHeaders[API.headers.clientId] = clientId;

  const bearerToken = authToken === undefined ? getAccessToken() : authToken;
  if (auth && bearerToken) {
    requestHeaders[API.headers.authorization] = `Bearer ${bearerToken}`;
  }

  try {
    if (csrf && isUnsafeMethod(method)) {
      requestHeaders[API.headers.csrf] = await getCsrfToken({
        force: attempt.csrfRetried,
      });
    }

    const response = await fetch(apiUrl(path), {
      method,
      headers: requestHeaders,
      body:
        body === undefined || isFormData(body) ? body : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'include',
    });
    const payload = await parsePayload(response);

    if (response.ok) return payload;
    const error = responseError(response, payload);

    if (isCsrfError(error) && csrf && !attempt.csrfRetried) {
      invalidateCsrfToken();
      return execute(path, options, { ...attempt, csrfRetried: true });
    }

    if (isRefreshableAuthError(error) && retryAuth && !attempt.authRetried) {
      try {
        await refreshAccessSession();
      } catch (refreshError) {
        if (refreshError?.status === 401) {
          clearAccessSession({ broadcast: true });
        }
        throw toApiError(refreshError);
      }
      return execute(path, options, { ...attempt, authRetried: true });
    }

    throw error;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const normalizedError = toApiError(error);
    if (normalizedError instanceof ApiError) throw normalizedError;
    if (error.name === 'AbortError') {
      throw new ApiError({
        code: 'REQUEST_TIMEOUT',
        message: MESSAGES.errors.timeout,
        status: 408,
      });
    }
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: MESSAGES.errors.network,
      status: 0,
    });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function request(
  path,
  {
    method = 'GET',
    body,
    timeoutMs = API.requestTimeoutMs,
    headers = {},
    auth = true,
    authToken,
    csrf = true,
    retryAuth = true,
  } = {},
) {
  return execute(
    path,
    {
      method: method.toUpperCase(),
      body,
      timeoutMs,
      headers,
      auth,
      authToken,
      csrf,
      retryAuth,
    },
    { authRetried: false, csrfRetried: false },
  );
}
