import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { config } from '../src/config/env.js';
import {
  createCaptureEmailDelivery,
  createWebhookEmailDelivery,
} from '../src/services/email-delivery.service.js';
import { createOutboxCryptoService } from '../src/services/outbox-crypto.service.js';
import { createOutboxWorker } from '../src/services/outbox-worker.service.js';

function withHttpServer(handler, callback) {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}/webhook`;
      try {
        await callback(url);
        server.close(resolve);
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

test('outbox decrypts credentials only for delivery and marks the row sent', async () => {
  const rawToken = 'secret-verification-token';
  const crypto = createOutboxCryptoService(config.outboxEncryptionKey);
  const event = {
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'VERIFY_EMAIL',
    recipient: 'ada@example.com',
    attempts: 1,
    payload: {
      user: { fullName: 'Ada Lovelace' },
      encrypted: crypto.encrypt(
        JSON.stringify({
          token: rawToken,
          expiresAt: '2026-11-04T12:00:00.000Z',
        }),
      ),
    },
  };
  assert.equal(JSON.stringify(event).includes(rawToken), false);

  const state = { sent: false };
  const repository = {
    claimBatch: async () => [event],
    markSent: async () => {
      state.sent = true;
    },
    markFailed: async () => assert.fail('Delivery should not fail.'),
  };
  const delivery = createCaptureEmailDelivery();
  const worker = createOutboxWorker({
    repository,
    outboxCrypto: crypto,
    emailDelivery: delivery,
    frontendUrl: 'http://localhost:3000',
  });
  const result = await worker.processBatch();

  assert.deepEqual(result, { claimed: 1, sent: 1 });
  assert.equal(state.sent, true);
  assert.equal(delivery.messages[0].variables.token, rawToken);
  assert.equal(delivery.messages[0].idempotencyKey, event.id);
});

test('createWebhookEmailDelivery requires url parameter', () => {
  assert.throws(
    () => createWebhookEmailDelivery({ url: '' }),
    /MAIL_WEBHOOK_URL is required to process the outbox\./,
  );
  assert.throws(
    () => createWebhookEmailDelivery({}),
    /MAIL_WEBHOOK_URL is required to process the outbox\./,
  );
});

test('createWebhookEmailDelivery posts payload with idempotency key and bearer token', async () => {
  const captured = [];
  const testMessage = {
    idempotencyKey: 'test-event-uuid-1',
    to: 'user@example.com',
    template: 'VERIFY_EMAIL',
    variables: {
      fullName: 'John Doe',
      token: 'verification-token-xyz',
      frontendUrl: 'http://localhost:3000',
    },
  };

  await withHttpServer(
    async (req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        captured.push({
          method: req.method,
          headers: req.headers,
          body: JSON.parse(body),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
    },
    async (url) => {
      const delivery = createWebhookEmailDelivery({
        url,
        bearerToken: 'test-bearer-token',
      });
      await delivery.send(testMessage);

      assert.equal(captured.length, 1);
      assert.equal(captured[0].method, 'POST');
      assert.equal(captured[0].headers['content-type'], 'application/json');
      assert.equal(captured[0].headers['idempotency-key'], testMessage.idempotencyKey);
      assert.equal(captured[0].headers['authorization'], 'Bearer test-bearer-token');
      assert.deepEqual(captured[0].body, testMessage);
    },
  );
});

test('createWebhookEmailDelivery throws error when webhook provider responds with non-ok status', async () => {
  const testMessage = {
    idempotencyKey: 'fail-uuid',
    to: 'fail@example.com',
    template: 'VERIFY_EMAIL',
    variables: {},
  };

  await withHttpServer(
    (req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found (tunnel offline)');
    },
    async (url) => {
      const delivery = createWebhookEmailDelivery({ url });
      await assert.rejects(
        () => delivery.send(testMessage),
        /Mail provider returned HTTP 404\./,
      );
    },
  );

  await withHttpServer(
    (req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    },
    async (url) => {
      const delivery = createWebhookEmailDelivery({ url });
      await assert.rejects(
        () => delivery.send(testMessage),
        /Mail provider returned HTTP 500\./,
      );
    },
  );
});

test('outbox worker processes batch through webhook delivery successfully', async () => {
  const rawToken = 'webhook-test-token-123';
  const crypto = createOutboxCryptoService(config.outboxEncryptionKey);
  const event = {
    id: '22222222-2222-4222-8222-222222222222',
    kind: 'VERIFY_EMAIL',
    recipient: 'test@example.com',
    attempts: 0,
    payload: {
      user: { fullName: 'Test User' },
      encrypted: crypto.encrypt(
        JSON.stringify({
          token: rawToken,
          expiresAt: '2026-11-05T12:00:00.000Z',
        }),
      ),
    },
  };

  let webhookReceived = null;
  await withHttpServer(
    (req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        webhookReceived = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ queued: true }));
      });
    },
    async (url) => {
      let markedSent = false;
      const repository = {
        claimBatch: async () => [event],
        markSent: async ({ id }) => {
          assert.equal(id, event.id);
          markedSent = true;
        },
        markFailed: async () => assert.fail('Should not mark failed on 200'),
      };

      const delivery = createWebhookEmailDelivery({
        url,
        bearerToken: 'resend-key-123',
      });
      const worker = createOutboxWorker({
        repository,
        outboxCrypto: crypto,
        emailDelivery: delivery,
        frontendUrl: 'http://localhost:3000',
      });

      const result = await worker.processBatch();
      assert.deepEqual(result, { claimed: 1, sent: 1 });
      assert.equal(markedSent, true);
      assert.equal(webhookReceived.to, 'test@example.com');
      assert.equal(webhookReceived.template, 'VERIFY_EMAIL');
      assert.equal(webhookReceived.variables.token, rawToken);
    },
  );
});

test('outbox worker marks row failed when webhook returns error', async () => {
  const crypto = createOutboxCryptoService(config.outboxEncryptionKey);
  const event = {
    id: '33333333-3333-4333-8333-333333333333',
    kind: 'VERIFY_EMAIL',
    recipient: 'test@example.com',
    attempts: 1,
    payload: {
      user: { fullName: 'Test User' },
      encrypted: crypto.encrypt(
        JSON.stringify({
          token: 'token-abc',
          expiresAt: '2026-11-05T12:00:00.000Z',
        }),
      ),
    },
  };

  await withHttpServer(
    (req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error');
    },
    async (url) => {
      let failureRecord = null;
      const repository = {
        claimBatch: async () => [event],
        markSent: async () => assert.fail('Should not mark sent on failure'),
        markFailed: async (record) => {
          failureRecord = record;
        },
      };

      const delivery = createWebhookEmailDelivery({ url });
      const worker = createOutboxWorker({
        repository,
        outboxCrypto: crypto,
        emailDelivery: delivery,
        frontendUrl: 'http://localhost:3000',
      });

      const result = await worker.processBatch();
      assert.deepEqual(result, { claimed: 1, sent: 0 });
      assert.ok(failureRecord);
      assert.equal(failureRecord.id, event.id);
      assert.equal(failureRecord.terminal, false);
      assert.ok(failureRecord.availableAt > new Date());
    },
  );
});

test('outbox worker marks terminal failure when max attempts reached', async () => {
  const crypto = createOutboxCryptoService(config.outboxEncryptionKey);
  const event = {
    id: '44444444-4444-4444-8444-444444444444',
    kind: 'VERIFY_EMAIL',
    recipient: 'test@example.com',
    attempts: 5,
    payload: {
      user: { fullName: 'Test User' },
      encrypted: crypto.encrypt(
        JSON.stringify({
          token: 'token-final',
          expiresAt: '2026-11-05T12:00:00.000Z',
        }),
      ),
    },
  };

  await withHttpServer(
    (req, res) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    },
    async (url) => {
      let failureRecord = null;
      const repository = {
        claimBatch: async () => [event],
        markSent: async () => assert.fail('Should not mark sent'),
        markFailed: async (record) => {
          failureRecord = record;
        },
      };

      const delivery = createWebhookEmailDelivery({ url });
      const worker = createOutboxWorker({
        repository,
        outboxCrypto: crypto,
        emailDelivery: delivery,
        frontendUrl: 'http://localhost:3000',
      });

      const result = await worker.processBatch();
      assert.deepEqual(result, { claimed: 1, sent: 0 });
      assert.ok(failureRecord);
      assert.equal(failureRecord.id, event.id);
      assert.equal(failureRecord.terminal, true);
    },
  );
});
