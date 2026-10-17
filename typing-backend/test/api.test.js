import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { createFakeRepositories } from './helpers.js';

const clients = {
  one: '11111111-1111-4111-8111-111111111111',
  two: '22222222-2222-4222-8222-222222222222',
};
const apps = [];

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
