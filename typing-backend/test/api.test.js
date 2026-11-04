import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { decodeJwt, decodeProtectedHeader } from 'jose';

import { buildApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { DependencyUnavailableError } from '../src/utils/app-error.js';
import { createFakeRepositories } from './helpers.js';

const ORIGIN = 'http://localhost:3000';
const BASE = '/api/v1';
const password = 'correct-horse-battery-staple!';
const clients = {
  one: '11111111-1111-4111-8111-111111111111',
  two: '22222222-2222-4222-8222-222222222222',
};
const apps = [];

function getSetCookies(response) {
  const cookies = response.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies : [cookies].filter(Boolean);
}

function cookieFrom(response, name) {
  const cookie = getSetCookies(response).find((value) =>
    value.startsWith(`${name}=`),
  );
  assert.ok(cookie, `Expected ${name} cookie.`);
  return cookie.split(';', 1)[0];
}

function createApp({ now, rateLimiter } = {}) {
  const repositories = createFakeRepositories();
  const app = buildApp({
    repositories,
    readyCheck: async () => {},
    now,
    rateLimiter,
  });
  apps.push(app);
  return { app, repositories };
}

async function csrf(app, { cookie } = {}) {
  const response = await app.inject({
    method: 'GET',
    url: `${BASE}/auth/csrf`,
    headers: {
      'sec-fetch-site': 'same-origin',
      ...(cookie ? { cookie } : {}),
    },
  });
  assert.equal(response.statusCode, 200);
  return {
    token: response.json().csrfToken,
    cookie: cookieFrom(response, 'keystroke_csrf'),
  };
}

function unsafeHeaders(proof, extraCookies = []) {
  return {
    origin: ORIGIN,
    'x-csrf-token': proof.token,
    cookie: [proof.cookie, ...extraCookies].join('; '),
  };
}

async function signUp(app, overrides = {}) {
  const proof = await csrf(app);
  return app.inject({
    method: 'POST',
    url: `${BASE}/auth/signup`,
    headers: unsafeHeaders(proof),
    payload: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      password,
      ...overrides,
    },
  });
}

async function createVerifiedAccount(context, overrides = {}) {
  const response = await signUp(context.app, overrides);
  assert.equal(response.statusCode, 201);
  context.repositories.auth._testing.activateUser(
    overrides.email || 'ada@example.com',
  );
  return response;
}

async function signIn(context, overrides = {}) {
  const proof = await csrf(context.app);
  const response = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/signin`,
    headers: unsafeHeaders(proof),
    payload: {
      email: 'ada@example.com',
      password,
      deviceLabel: 'Test browser',
      ...overrides,
    },
  });
  if (response.statusCode !== 200) return { response, proof };
  return {
    response,
    accessToken: response.json().accessToken,
    refreshCookie: cookieFrom(response, 'keystroke_refresh'),
    proof: {
      token: response.json().csrfToken,
      cookie: cookieFrom(response, 'keystroke_csrf'),
    },
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

test('all API resources are consistently versioned and CORS permits auth headers', async () => {
  const { app } = createApp();
  const preflight = await app.inject({
    method: 'OPTIONS',
    url: `${BASE}/tests/start`,
    headers: {
      origin: ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers':
        'content-type,x-client-id,authorization,x-csrf-token',
    },
  });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], ORIGIN);
  assert.match(
    preflight.headers['access-control-allow-headers'],
    /Authorization/i,
  );

  const start = await app.inject({
    method: 'POST',
    url: `${BASE}/tests/start`,
    headers: { origin: ORIGIN, 'x-client-id': clients.one },
    payload: { mode: 'timed', duration: 30 },
  });
  assert.equal(start.statusCode, 200);
  assert.equal(
    (await app.inject({ method: 'GET', url: '/api/health' })).statusCode,
    404,
  );
});

test('CSRF bootstrap supports same-origin GET and unsafe requests reject missing proof', async () => {
  const { app } = createApp();
  const proof = await csrf(app);
  assert.match(proof.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const rejected = await app.inject({
    method: 'POST',
    url: `${BASE}/auth/signup`,
    headers: { origin: ORIGIN },
    payload: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      password,
    },
  });
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.json().error.code, 'INVALID_CSRF');
  assert.equal(rejected.headers['cache-control'], 'no-store');
});

test('Redis limiter outages preserve liveness and fail sensitive authentication closed', async () => {
  const unavailable = new DependencyUnavailableError();
  const rateLimiter = {
    start: async () => {
      throw unavailable;
    },
    close: async () => {},
    checkAvailability: async () => {
      throw unavailable;
    },
    check: async () => {
      throw unavailable;
    },
  };
  const { app } = createApp({ rateLimiter });

  const live = await app.inject({ method: 'GET', url: `${BASE}/health` });
  assert.equal(live.statusCode, 200);

  const ready = await app.inject({
    method: 'GET',
    url: `${BASE}/health/ready`,
  });
  assert.equal(ready.statusCode, 503);
  assert.equal(ready.json().error.code, 'DEPENDENCY_UNAVAILABLE');

  const rejected = await signUp(app);
  assert.equal(rejected.statusCode, 503);
  assert.equal(rejected.json().error.code, 'DEPENDENCY_UNAVAILABLE');
});

test('untrusted browser origins receive a controlled 403 instead of an internal error', async () => {
  const { app } = createApp();
  const response = await app.inject({
    method: 'GET',
    url: `${BASE}/auth/csrf`,
    headers: { origin: 'https://attacker.example' },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'FORBIDDEN');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('signup is pending until a single-use verification token is consumed', async () => {
  const context = createApp();
  const signup = await signUp(context.app);
  assert.equal(signup.statusCode, 201);
  assert.equal(signup.json().user.status, 'PENDING_VERIFICATION');
  assert.equal(signup.json().user.roles[0], 'ROLE_USER');
  assert.equal(
    getSetCookies(signup).some((cookie) =>
      cookie.startsWith('keystroke_refresh='),
    ),
    false,
  );

  const pendingLogin = await signIn(context);
  assert.equal(pendingLogin.response.statusCode, 403);
  assert.equal(pendingLogin.response.json().error.code, 'EMAIL_NOT_VERIFIED');

  const rawToken = 'v'.repeat(43);
  context.repositories.auth._testing.setVerificationToken(
    'ada@example.com',
    rawToken,
    new Date(Date.now() + 60_000),
  );
  const proof = await csrf(context.app);
  const verified = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/verify-email`,
    headers: unsafeHeaders(proof),
    payload: { token: rawToken },
  });
  assert.equal(verified.statusCode, 200);
  assert.equal(verified.json().user.status, 'ACTIVE');

  const replay = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/verify-email`,
    headers: unsafeHeaders(proof),
    payload: { token: rawToken },
  });
  assert.equal(replay.statusCode, 200);
  assert.match(replay.json().message, /already verified/i);
});

test('signin returns a PS256 bearer token and only refresh is HttpOnly', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const session = await signIn(context);
  assert.equal(session.response.statusCode, 200);
  assert.equal(session.response.json().tokenType, 'Bearer');
  assert.equal(session.response.json().expiresIn, config.accessTokenTtlSeconds);
  assert.equal(decodeProtectedHeader(session.accessToken).alg, 'PS256');
  assert.equal(decodeProtectedHeader(session.accessToken).typ, 'at+jwt');
  const claims = decodeJwt(session.accessToken);
  assert.equal(claims.token_use, 'access');
  assert.equal(typeof claims.sid, 'string');
  assert.equal(typeof claims.jti, 'string');
  assert.deepEqual(claims.roles, ['ROLE_USER']);
  assert.equal(Number.isInteger(claims.sv), true);
  assert.equal(session.response.json().refreshToken, undefined);
  assert.match(
    getSetCookies(session.response).find((cookie) =>
      cookie.startsWith('keystroke_refresh='),
    ),
    /HttpOnly/,
  );

  const me = await context.app.inject({
    method: 'GET',
    url: `${BASE}/account/me`,
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().email, 'ada@example.com');
});

test('unknown and incorrect credentials share the same response', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const unknown = await signIn(context, { email: 'nobody@example.com' });
  const wrong = await signIn(context, { password: 'wrong-password-value' });
  assert.equal(unknown.response.statusCode, 401);
  assert.equal(wrong.response.statusCode, 401);
  assert.deepEqual(unknown.response.json(), wrong.response.json());
  assert.equal(wrong.response.json().error.code, 'INVALID_CREDENTIALS');
});

test('the lockout threshold never changes a wrong-password response', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  let last;
  for (let attempt = 0; attempt < config.lockoutThreshold; attempt += 1) {
    last = await signIn(context, { password: 'wrong-password-value' });
    assert.equal(last.response.statusCode, 401);
    assert.equal(last.response.json().error.code, 'INVALID_CREDENTIALS');
  }
  assert.equal(
    context.repositories.auth._testing.users.values().next().value.status,
    'LOCKED',
  );
});

test('refresh rotates once, replay revokes the stable session, and stale access fails', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const first = await signIn(context);
  const refreshHeaders = unsafeHeaders(first.proof, [first.refreshCookie]);
  const rotated = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/refresh`,
    headers: refreshHeaders,
  });
  assert.equal(rotated.statusCode, 200);
  const secondRefresh = cookieFrom(rotated, 'keystroke_refresh');
  const secondProof = {
    token: rotated.json().csrfToken,
    cookie: cookieFrom(rotated, 'keystroke_csrf'),
  };

  const replay = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/refresh`,
    headers: refreshHeaders,
  });
  assert.equal(replay.statusCode, 401);
  assert.equal(replay.json().error.code, 'REFRESH_REUSE_DETECTED');

  const descendant = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/refresh`,
    headers: unsafeHeaders(secondProof, [secondRefresh]),
  });
  assert.equal(descendant.statusCode, 401);
  const staleAccess = await context.app.inject({
    method: 'GET',
    url: `${BASE}/account/me`,
    headers: { authorization: `Bearer ${rotated.json().accessToken}` },
  });
  assert.equal(staleAccess.statusCode, 401);
});

test('simultaneous refresh creates no two usable successors', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const first = await signIn(context);
  const request = {
    method: 'POST',
    url: `${BASE}/auth/refresh`,
    headers: unsafeHeaders(first.proof, [first.refreshCookie]),
  };
  const responses = await Promise.all([
    context.app.inject(request),
    context.app.inject(request),
  ]);
  assert.deepEqual(
    responses.map((response) => response.statusCode).sort(),
    [200, 401],
  );
  const winner = responses.find((response) => response.statusCode === 200);
  const stale = await context.app.inject({
    method: 'GET',
    url: `${BASE}/account/me`,
    headers: { authorization: `Bearer ${winner.json().accessToken}` },
  });
  assert.equal(stale.statusCode, 401);
});

test('logout-all increments security state and invalidates every access token', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const first = await signIn(context, { deviceLabel: 'Laptop' });
  const second = await signIn(context, { deviceLabel: 'Phone' });

  const response = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/logout-all`,
    headers: {
      ...unsafeHeaders(first.proof, [first.refreshCookie]),
      authorization: `Bearer ${first.accessToken}`,
    },
  });
  assert.equal(response.statusCode, 200);
  for (const accessToken of [first.accessToken, second.accessToken]) {
    const stale = await context.app.inject({
      method: 'GET',
      url: `${BASE}/account/me`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(stale.statusCode, 401);
  }
});

test('logout is idempotent after browser cookies have already been cleared', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const session = await signIn(context);
  const first = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/logout`,
    headers: unsafeHeaders(session.proof, [session.refreshCookie]),
  });
  assert.equal(first.statusCode, 200);
  const repeated = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/logout`,
    headers: { origin: ORIGIN },
  });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.json().message, 'Signed out.');
});

test('RBAC rejects users and permits an authoritative admin role', async () => {
  const userContext = createApp();
  await createVerifiedAccount(userContext);
  const userSession = await signIn(userContext);
  const rejected = await userContext.app.inject({
    method: 'GET',
    url: `${BASE}/admin/dashboard`,
    headers: { authorization: `Bearer ${userSession.accessToken}` },
  });
  assert.equal(rejected.statusCode, 403);

  const adminContext = createApp();
  await createVerifiedAccount(adminContext);
  adminContext.repositories.auth._testing.setRoles('ada@example.com', [
    'ROLE_USER',
    'ROLE_ADMIN',
  ]);
  const adminSession = await signIn(adminContext);
  const allowed = await adminContext.app.inject({
    method: 'GET',
    url: `${BASE}/admin/dashboard`,
    headers: { authorization: `Bearer ${adminSession.accessToken}` },
  });
  assert.equal(allowed.statusCode, 200);
});

test('session listing is bounded and a user cannot revoke another user session', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const session = await signIn(context);
  const listed = await context.app.inject({
    method: 'GET',
    url: `${BASE}/account/sessions?limit=10`,
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().sessions.length, 1);
  assert.equal(listed.json().sessions[0].current, true);

  const otherSessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const rejected = await context.app.inject({
    method: 'DELETE',
    url: `${BASE}/account/sessions/${otherSessionId}`,
    headers: {
      ...unsafeHeaders(session.proof, [session.refreshCookie]),
      authorization: `Bearer ${session.accessToken}`,
    },
  });
  assert.equal(rejected.statusCode, 404);
});

test('password reset consumes its token and immediately revokes sessions', async () => {
  const context = createApp();
  await createVerifiedAccount(context);
  const session = await signIn(context);
  const token = 'r'.repeat(64);
  context.repositories.auth._testing.setResetToken(
    'ada@example.com',
    token,
    new Date(Date.now() + 60_000),
  );
  const proof = await csrf(context.app);
  const reset = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/reset-password`,
    headers: unsafeHeaders(proof),
    payload: { token, newPassword: 'new-correct-horse-password!' },
  });
  assert.equal(reset.statusCode, 200);
  const replay = await context.app.inject({
    method: 'POST',
    url: `${BASE}/auth/reset-password`,
    headers: unsafeHeaders(proof),
    payload: { token, newPassword: 'another-correct-horse-password!' },
  });
  assert.equal(replay.statusCode, 401);
  const stale = await context.app.inject({
    method: 'GET',
    url: `${BASE}/account/me`,
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  assert.equal(stale.statusCode, 401);
});

test('disabled and deleted accounts cannot be reactivated through failed signins', async () => {
  for (const status of ['DISABLED', 'DELETED']) {
    const context = createApp();
    await createVerifiedAccount(context);
    context.repositories.auth._testing.setStatus('ada@example.com', status, {
      emailVerifiedAt: new Date(),
    });
    const attempt = await signIn(context, { password: 'wrong-password-value' });
    assert.equal(attempt.response.statusCode, 401);
    assert.equal(
      context.repositories.auth._testing.users.values().next().value.status,
      status,
    );
  }
});

test('typing submission remains server verified under /api/v1', async () => {
  const { app } = createApp();
  const start = await app.inject({
    method: 'POST',
    url: `${BASE}/tests/start`,
    headers: { 'x-client-id': clients.one },
    payload: { mode: 'timed', duration: 30 },
  });
  assert.equal(start.statusCode, 200);
  const submit = await app.inject({
    method: 'POST',
    url: `${BASE}/tests/${start.json().testId}/submit`,
    headers: { 'x-client-id': clients.one },
    payload: { typedText: 'word0 word1', elapsedMs: 1000 },
  });
  assert.equal(submit.statusCode, 200);
  assert.ok('wpm' in submit.json());

  const crossClient = await app.inject({
    method: 'POST',
    url: `${BASE}/tests/${start.json().testId}/submit`,
    headers: { 'x-client-id': clients.two },
    payload: { typedText: 'word0', elapsedMs: 1000 },
  });
  assert.equal(crossClient.statusCode, 404);
});
