import 'dotenv/config';

import { randomUUID } from 'node:crypto';

const baseUrl =
  process.env.SMOKE_BASE_URL ||
  `http://localhost:${process.env.PORT || 4000}/api`;
const clientId = randomUUID();

async function call(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
      ...(options.headers || {}),
    },
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke assertion failed: ${message}`);
}

const session = await call('/tests/start', {
  method: 'POST',
  body: JSON.stringify({ mode: 'timed', duration: 15 }),
});
assert(typeof session.testId === 'string', 'start response has testId');
assert(
  typeof session.text === 'string' && session.text.length > 0,
  'start response has text',
);

const result = await call(`/tests/${session.testId}/submit`, {
  method: 'POST',
  body: JSON.stringify({
    typedText: session.text.slice(0, 10),
    elapsedMs: 1000,
  }),
});
assert(result.testId === session.testId, 'submit response matches testId');
assert(typeof result.wpm === 'number', 'submit response has wpm');
assert(typeof result.accuracy === 'number', 'submit response has accuracy');

const history = await call('/tests/history?limit=20');
assert(Array.isArray(history.entries), 'history response has entries');

const summary = await call('/stats/summary');
assert(
  typeof summary.totalTests === 'number',
  'summary response has totalTests',
);
assert(Array.isArray(summary.trend), 'summary response has trend');

process.stdout.write('Smoke test passed.\n');
