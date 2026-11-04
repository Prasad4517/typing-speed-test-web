import { API } from '@/constants/api';

const CHANNEL_NAME = 'keystroke.auth.v1';
const REFRESH_LOCK_NAME = 'keystroke-auth-refresh-v1';
const REFRESH_WAIT_MS = 10_000;
const REFRESH_LOCK_TTL_MS = 15_000;
const REFRESH_LOCK_POLL_MS = 24;
const AUTH_REQUEST_TIMEOUT_MS = 10_000;
const REFRESH_CHOICE_PREFIX = 'keystroke.auth.refresh.choice.';
const REFRESH_TICKET_PREFIX = 'keystroke.auth.refresh.ticket.';
const EXPIRY_SKEW_MS = 10_000;

let accessToken = null;
let accessTokenExpiresAt = 0;
let csrfToken = null;
let csrfPromise = null;
let refreshPromise = null;
let authGeneration = 0;
let refreshAllowed = true;
let channel = null;
let peerRefresh = null;
let peerRefreshTimer = null;
const sessionListeners = new Set();

function browserWindow() {
  return typeof window === 'undefined' ? null : window;
}

function apiUrl(path) {
  if (path.startsWith(`${API.basePath}/`) || path === API.basePath) return path;
  return `${API.basePath}${path.startsWith('/') ? path : `/${path}`}`;
}

function randomId() {
  const browser = browserWindow();
  if (browser?.crypto?.randomUUID) return browser.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function browserStorage() {
  const browser = browserWindow();
  try {
    if (!browser?.localStorage) return null;
    const probe = `${REFRESH_TICKET_PREFIX}probe`;
    browser.localStorage.setItem(probe, '1');
    browser.localStorage.removeItem(probe);
    return browser.localStorage;
  } catch {
    return null;
  }
}

function storedRecords(storage, prefix) {
  const records = [];
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  );
  for (const key of keys) {
    if (!key?.startsWith(prefix)) continue;
    try {
      const value = JSON.parse(storage.getItem(key));
      records.push({ key, ...value });
    } catch {
      storage.removeItem(key);
    }
  }
  return records;
}

function activeRecords(storage, prefix) {
  const now = Date.now();
  return storedRecords(storage, prefix).filter((record) => {
    if (!record.expiresAt || record.expiresAt <= now) {
      storage.removeItem(record.key);
      return false;
    }
    return true;
  });
}

function ticketPrecedes(left, right) {
  return (
    left.number < right.number ||
    (left.number === right.number && left.owner < right.owner)
  );
}

async function acquireStorageRefreshLock(storage) {
  const choiceKey = `${REFRESH_CHOICE_PREFIX}${tabId}`;
  const ticketKey = `${REFRESH_TICKET_PREFIX}${tabId}`;
  const expiresAt = () => Date.now() + REFRESH_LOCK_TTL_MS;

  storage.setItem(
    choiceKey,
    JSON.stringify({ owner: tabId, expiresAt: expiresAt() }),
  );
  const existingTickets = activeRecords(storage, REFRESH_TICKET_PREFIX);
  const highestTicket = existingTickets.reduce(
    (highest, ticket) => Math.max(highest, Number(ticket.number) || 0),
    0,
  );
  const ticket = {
    owner: tabId,
    number: highestTicket + 1,
    expiresAt: expiresAt(),
  };
  storage.setItem(ticketKey, JSON.stringify(ticket));
  storage.removeItem(choiceKey);

  while (true) {
    const anotherTabChoosing = activeRecords(
      storage,
      REFRESH_CHOICE_PREFIX,
    ).some((choice) => choice.owner !== tabId);
    const earlierTicket = activeRecords(storage, REFRESH_TICKET_PREFIX).some(
      (candidate) =>
        candidate.owner !== tabId && ticketPrecedes(candidate, ticket),
    );

    if (!anotherTabChoosing && !earlierTicket) break;
    ticket.expiresAt = expiresAt();
    storage.setItem(ticketKey, JSON.stringify(ticket));
    await pause(REFRESH_LOCK_POLL_MS);
  }

  const heartbeat = setInterval(() => {
    ticket.expiresAt = expiresAt();
    try {
      storage.setItem(ticketKey, JSON.stringify(ticket));
    } catch {
      // The expiry safely releases a lock if storage becomes unavailable.
    }
  }, REFRESH_LOCK_TTL_MS / 3);

  return () => {
    clearInterval(heartbeat);
    try {
      const current = JSON.parse(storage.getItem(ticketKey));
      if (current?.owner === tabId && current?.number === ticket.number) {
        storage.removeItem(ticketKey);
      }
    } catch {
      storage.removeItem(ticketKey);
    }
  };
}

const tabId = randomId();

function notifySession(type, detail = {}) {
  sessionListeners.forEach((listener) => {
    try {
      listener({ type, ...detail });
    } catch {
      // A view listener must never interrupt token rotation or logout.
    }
  });
}

function clearPeerRefresh() {
  if (peerRefreshTimer) clearTimeout(peerRefreshTimer);
  peerRefreshTimer = null;
  peerRefresh?.resolve();
  peerRefresh = null;
}

function handleChannelMessage(event) {
  const message = event?.data;
  if (!message || message.source === tabId) return;

  if (message.type === 'refresh-start') {
    clearPeerRefresh();
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    peerRefresh = { promise, resolve };
    peerRefreshTimer = setTimeout(clearPeerRefresh, REFRESH_WAIT_MS);
    return;
  }

  if (message.type === 'refresh-end') {
    clearPeerRefresh();
    return;
  }

  if (message.type === 'logout' || message.type === 'session-expired') {
    clearAccessSession({ broadcast: false, reason: message.type });
    return;
  }

  if (message.type === 'account-changed') {
    clearAccessSession({ broadcast: false, reason: 'session-expired' });
  }
}

function getChannel() {
  const browser = browserWindow();
  if (!browser?.BroadcastChannel) return null;

  if (!channel) {
    try {
      channel = new browser.BroadcastChannel(CHANNEL_NAME);
      if (channel.addEventListener) {
        channel.addEventListener('message', handleChannelMessage);
      } else {
        channel.onmessage = handleChannelMessage;
      }
    } catch {
      channel = null;
    }
  }
  return channel;
}

function broadcast(type) {
  try {
    getChannel()?.postMessage({ type, source: tabId, at: Date.now() });
  } catch {
    // Authentication still works when cross-tab channels are unavailable.
  }
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

function authError(response, payload) {
  const error = new Error(payload?.error?.message || 'The request failed.');
  error.name = 'AuthClientError';
  error.code = payload?.error?.code || 'HTTP_ERROR';
  error.status = response.status;
  error.details = payload?.error?.details || [];
  return error;
}

function isCsrfError(error) {
  return (
    error?.status === 403 &&
    typeof error.code === 'string' &&
    error.code.toUpperCase().includes('CSRF')
  );
}

export function getAccessToken() {
  if (!accessToken) return null;
  if (
    accessTokenExpiresAt &&
    accessTokenExpiresAt <= Date.now() + EXPIRY_SKEW_MS
  ) {
    accessToken = null;
    accessTokenExpiresAt = 0;
    return null;
  }
  return accessToken;
}

export function installAccessSession(
  payload,
  expectedGeneration = authGeneration,
  { enableRefresh = false } = {},
) {
  if (enableRefresh) refreshAllowed = true;
  if (
    !refreshAllowed ||
    expectedGeneration !== authGeneration ||
    !payload?.accessToken
  ) {
    return false;
  }

  accessToken = payload.accessToken;
  const lifetimeSeconds = Number(payload.expiresIn);
  accessTokenExpiresAt = Number.isFinite(lifetimeSeconds)
    ? Date.now() + lifetimeSeconds * 1000
    : 0;
  csrfToken =
    typeof payload.csrfToken === 'string' && payload.csrfToken
      ? payload.csrfToken
      : null;
  notifySession('authenticated', { user: payload.user || null });
  return true;
}

export function clearAccessSession({
  broadcast: shouldBroadcast = false,
  reason = 'session-expired',
  clearCsrf = true,
} = {}) {
  authGeneration += 1;
  refreshAllowed = false;
  accessToken = null;
  accessTokenExpiresAt = 0;
  if (clearCsrf) csrfToken = null;
  notifySession(reason);
  if (shouldBroadcast) broadcast(reason);
}

export function beginLogout() {
  refreshAllowed = false;
  const token = getAccessToken();
  clearAccessSession({ reason: 'logout', clearCsrf: false });
  broadcast('logout');
  return { accessToken: token, generation: authGeneration };
}

export function finishLogout() {
  authGeneration += 1;
  refreshAllowed = false;
  accessToken = null;
  accessTokenExpiresAt = 0;
  csrfToken = null;
  broadcast('logout');
}

export async function terminateAccessSession(operation) {
  if (refreshPromise) {
    try {
      await refreshPromise;
    } catch {
      // Logout still needs to clear the cookie after a failed refresh.
    }
  }

  return withCrossTabRefreshLock(async () => {
    const { accessToken: token } = beginLogout();
    try {
      return await operation(token);
    } finally {
      finishLogout();
    }
  });
}

export async function establishAccessSession(operation) {
  if (refreshPromise) {
    try {
      await refreshPromise;
    } catch {
      // A direct sign-in may recover from a failed prior session refresh.
    }
  }

  return withCrossTabRefreshLock(async () => {
    const response = await operation();
    authGeneration += 1;
    const installed = installAccessSession(response, authGeneration, {
      enableRefresh: true,
    });
    if (!installed) {
      clearAccessSession({ reason: 'session-expired' });
      throw new Error('The server returned an invalid authentication session.');
    }
    broadcast('account-changed');
    return response;
  });
}

export function subscribeAuthSession(listener) {
  sessionListeners.add(listener);
  getChannel();
  return () => sessionListeners.delete(listener);
}

export function invalidateCsrfToken() {
  csrfToken = null;
}

export async function getCsrfToken({ force = false } = {}) {
  if (!force && csrfToken) return csrfToken;
  if (!force && csrfPromise) return csrfPromise;

  const operation = (async () => {
    const response = await fetchWithTimeout(apiUrl(API.endpoints.csrf), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    });
    const payload = await parseResponse(response);
    if (!response.ok) throw authError(response, payload);
    if (!payload?.csrfToken) {
      throw new Error('The server returned an invalid CSRF response.');
    }
    csrfToken = payload.csrfToken;
    return csrfToken;
  })();

  csrfPromise = operation;
  try {
    return await operation;
  } finally {
    if (csrfPromise === operation) csrfPromise = null;
  }
}

async function requestRefresh(generation, csrfRetried = false) {
  const token = await getCsrfToken({ force: csrfRetried });
  const response = await fetchWithTimeout(apiUrl(API.endpoints.refresh), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      [API.headers.csrf]: token,
    },
    credentials: 'include',
    cache: 'no-store',
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = authError(response, payload);
    if (isCsrfError(error) && !csrfRetried) {
      invalidateCsrfToken();
      return requestRefresh(generation, true);
    }
    throw error;
  }
  installAccessSession(payload, generation);
  return payload;
}

async function performRefresh(generation) {
  broadcast('refresh-start');

  try {
    return await requestRefresh(generation);
  } catch (error) {
    if (error?.status === 401 && generation === authGeneration) {
      clearAccessSession({ broadcast: true });
    }
    throw error;
  } finally {
    broadcast('refresh-end');
  }
}

async function withCrossTabRefreshLock(operation) {
  const browser = browserWindow();
  const locks = browser?.navigator?.locks;

  if (locks?.request) {
    return locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, operation);
  }

  const storage = browserStorage();
  if (storage) {
    const release = await acquireStorageRefreshLock(storage);
    try {
      return await operation();
    } finally {
      release();
    }
  }

  if (peerRefresh) await peerRefresh.promise;
  return operation();
}

export function refreshAccessSession() {
  if (!refreshAllowed) {
    const error = new Error('The authentication session has ended.');
    error.name = 'AuthClientError';
    error.code = 'UNAUTHORIZED';
    error.status = 401;
    return Promise.reject(error);
  }
  if (refreshPromise) return refreshPromise;
  const generation = authGeneration;

  const operation = withCrossTabRefreshLock(() => {
    if (!refreshAllowed || generation !== authGeneration) {
      const error = new Error('The authentication session has ended.');
      error.name = 'AuthClientError';
      error.code = 'UNAUTHORIZED';
      error.status = 401;
      throw error;
    }
    return performRefresh(generation);
  });
  refreshPromise = operation;
  operation.then(
    () => {
      if (refreshPromise === operation) refreshPromise = null;
    },
    () => {
      if (refreshPromise === operation) refreshPromise = null;
    },
  );
  return operation;
}

export function __resetAuthClientForTests() {
  accessToken = null;
  accessTokenExpiresAt = 0;
  csrfToken = null;
  csrfPromise = null;
  refreshPromise = null;
  authGeneration = 0;
  refreshAllowed = true;
  clearPeerRefresh();
  if (channel) channel.close();
  channel = null;
  sessionListeners.clear();
  const storage = browserStorage();
  storage?.removeItem(`${REFRESH_CHOICE_PREFIX}${tabId}`);
  storage?.removeItem(`${REFRESH_TICKET_PREFIX}${tabId}`);
}
