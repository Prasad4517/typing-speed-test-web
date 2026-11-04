const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 25;
const LEASE_MS = 60_000;

function deliveryMessage(event, outboxCrypto, frontendUrl) {
  const base = {
    idempotencyKey: event.id,
    to: event.recipient,
    template: event.kind,
    variables: {
      fullName: event.payload?.user?.fullName || '',
      frontendUrl,
      occurredAt: event.payload?.occurredAt,
    },
  };
  if (!event.payload?.encrypted) return base;
  const secret = JSON.parse(outboxCrypto.decrypt(event.payload.encrypted));
  return {
    ...base,
    variables: {
      ...base.variables,
      token: secret.token,
      expiresAt: secret.expiresAt,
    },
  };
}

export function createOutboxWorker({
  repository,
  outboxCrypto,
  emailDelivery,
  frontendUrl,
  now = () => new Date(),
}) {
  return Object.freeze({
    async processBatch() {
      const startedAt = now();
      const events = await repository.claimBatch({
        now: startedAt,
        leaseUntil: new Date(startedAt.getTime() + LEASE_MS),
        limit: BATCH_SIZE,
      });
      let sent = 0;
      for (const event of events) {
        try {
          await emailDelivery.send(
            deliveryMessage(event, outboxCrypto, frontendUrl),
          );
          await repository.markSent({ id: event.id, processedAt: now() });
          sent += 1;
        } catch {
          const terminal = event.attempts >= MAX_ATTEMPTS;
          const backoffMs = Math.min(
            60 * 60 * 1000,
            30_000 * 2 ** Math.max(0, event.attempts - 1),
          );
          await repository.markFailed({
            id: event.id,
            terminal,
            availableAt: new Date(now().getTime() + backoffMs),
          });
        }
      }
      return { claimed: events.length, sent };
    },
  });
}
