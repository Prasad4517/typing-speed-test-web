import { getClientId } from '@/lib/client-id';
import { API } from '@/constants/api';
import { MESSAGES } from '@/constants/messages';

export class ApiError extends Error {
  constructor({ code, message, status, details = [] }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new ApiError({
      code: 'CONFIGURATION_ERROR',
      message: 'The frontend API URL is not configured.',
      status: 500,
    });
  }

  return baseUrl.replace(/\/$/, '');
}

export async function request(
  path,
  { method = 'GET', body, timeoutMs = API.requestTimeoutMs, headers = {} } = {},
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const clientId = getClientId();
  const requestHeaders = { Accept: 'application/json', ...headers };

  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (clientId) requestHeaders[API.headers.clientId] = clientId;

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError({
        code: payload?.error?.code || 'HTTP_ERROR',
        message: payload?.error?.message || 'The request failed.',
        status: response.status,
        details: payload?.error?.details || [],
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
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
    window.clearTimeout(timeout);
  }
}
