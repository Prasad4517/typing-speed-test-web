import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/application.js';
import { config } from '../src/config/env.js';
import { createFakeRepositories } from './helpers.js';

const clients = {
  one: '11111111-1111-4111-8111-111111111111',
  two: '22222222-2222-4222-8222-222222222222',
};
const apps = [];
const password = 'correct-horse-battery-staple';

function getSetCookie(response, name) {
  const cookies = response.headers['set-cookie'];
  const allCookies = Array.isArray(cookies) ? cookies : [cookies];
  const matchedCookie = allCookies.find((cookie) =>
    cookie?.startsWith(`${name}=`),
  );

  assert.ok(matchedCookie, `Expected ${name} cookie to be set.`);
  return matchedCookie;
}

function getCookie(response, name) {
  const matchedCookie = getSetCookie(response, name);
  return matchedCookie.split(';', 1)[0];
}

async function signUp(app, overrides = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      password,
      ...overrides,
    },
  });
}

function createApp() {
  const app = buildApp({
    repositories: createFakeRepositories(),
    readyCheck: async () => {},
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

test('CORS headers are present on preflight and API responses', async () => {
  const app = createApp();
  const origin = 'http://localhost:3000';
  const preflight = await app.inject({
    method: 'OPTIONS',
    url: '/api/tests/start',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-client-id',
    },
  });

  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], origin);

  const response = await app.inject({
    method: 'POST',
    url: '/api/tests/start',
    headers: { origin, 'x-client-id': clients.one },
    payload: { mode: 'timed', duration: 30 },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['access-control-allow-origin'], origin);
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
});

test('sign up sets HttpOnly auth cookies and /me reads the access token', async () => {
  const app = createApp();
  const response = await signUp(app);

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().user.email, 'ada@example.com');
  assert.equal(response.json().user.passwordHash, undefined);
  assert.match(getSetCookie(response, 'keystroke_access'), /HttpOnly/);
  assert.match(getSetCookie(response, 'keystroke_refresh'), /HttpOnly/);

  const me = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { cookie: getCookie(response, 'keystroke_access') },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().email, 'ada@example.com');

  const updatedProfile = await app.inject({
    method: 'PATCH',
    url: '/api/me',
    headers: { cookie: getCookie(response, 'keystroke_access') },
    payload: { fullName: 'Ada Byron Lovelace' },
  });
  assert.equal(updatedProfile.statusCode, 200);
  assert.equal(updatedProfile.json().fullName, 'Ada Byron Lovelace');
});

test('login returns the same unauthorized response for an unknown email and wrong password', async () => {
  const app = createApp();
  await signUp(app);

  const unknownEmail = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'unknown@example.com', password },
  });
  const wrongPassword = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ada@example.com', password: 'wrong-password' },
  });

  assert.equal(unknownEmail.statusCode, 401);
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(unknownEmail.json().error.message, 'Invalid email or password.');
  assert.equal(
    wrongPassword.json().error.message,
    'Invalid email or password.',
  );
});

test('refresh rotates a session and rejects refresh-token replay for the entire family', async () => {
  const app = createApp();
  const signUpResponse = await signUp(app);
  const firstRefreshCookie = getCookie(signUpResponse, 'keystroke_refresh');

  const rotated = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: { cookie: firstRefreshCookie },
  });
  assert.equal(rotated.statusCode, 200);
  const secondRefreshCookie = getCookie(rotated, 'keystroke_refresh');
  assert.notEqual(secondRefreshCookie, firstRefreshCookie);

  const replay = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: { cookie: firstRefreshCookie },
  });
  assert.equal(replay.statusCode, 401);

  const familyRevoked = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: { cookie: secondRefreshCookie },
  });
  assert.equal(familyRevoked.statusCode, 401);
});

test('start and submit returns a verified result', async () => {
  const app = createApp();
  const start = await app.inject({
    method: 'POST',
    url: '/api/tests/start',
    headers: { 'x-client-id': clients.one },
    payload: { mode: 'timed', duration: 30 },
  });
  assert.equal(start.statusCode, 200);
  const session = start.json();

  const submit = await app.inject({
    method: 'POST',
    url: `/api/tests/${session.testId}/submit`,
    headers: { 'x-client-id': clients.one },
    payload: { typedText: 'word0 word1', elapsedMs: 1000 },
  });
  assert.equal(submit.statusCode, 200);
  assert.equal(submit.json().testId, session.testId);
  assert.ok('wpm' in submit.json());
});

test('missing client id returns the standard validation envelope', async () => {
  const app = createApp();
  const response = await app.inject({
    method: 'POST',
    url: '/api/tests/start',
    payload: { mode: 'timed', duration: 30 },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'VALIDATION_ERROR');
});

test('a different client cannot submit the session', async () => {
  const app = createApp();
  const start = await app.inject({
    method: 'POST',
    url: '/api/tests/start',
    headers: { 'x-client-id': clients.one },
    payload: { mode: 'timed', duration: 30 },
  });
  const response = await app.inject({
    method: 'POST',
    url: `/api/tests/${start.json().testId}/submit`,
    headers: { 'x-client-id': clients.two },
    payload: { typedText: 'word0', elapsedMs: 1000 },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'NOT_FOUND');
});

test('double submit is rejected as a conflict', async () => {
  const app = createApp();
  const start = await app.inject({
    method: 'POST',
    url: '/api/tests/start',
    headers: { 'x-client-id': clients.one },
    payload: { mode: 'timed', duration: 30 },
  });
  const url = `/api/tests/${start.json().testId}/submit`;
  const payload = { typedText: 'word0', elapsedMs: 1000 };
  const headers = { 'x-client-id': clients.one };
  assert.equal(
    (await app.inject({ method: 'POST', url, headers, payload })).statusCode,
    200,
  );
  const duplicate = await app.inject({ method: 'POST', url, headers, payload });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().error.code, 'CONFLICT');
});

test('suspiciously short elapsed time is rejected', async () => {
  const app = createApp();
  const start = await app.inject({
    method: 'POST',
    url: '/api/tests/start',
    headers: { 'x-client-id': clients.one },
    payload: { mode: 'timed', duration: 30 },
  });
  const response = await app.inject({
    method: 'POST',
    url: `/api/tests/${start.json().testId}/submit`,
    headers: { 'x-client-id': clients.one },
    payload: { typedText: 'word0', elapsedMs: config.minElapsedMs - 1 },
  });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, 'SUSPICIOUS_RESULT');
});
