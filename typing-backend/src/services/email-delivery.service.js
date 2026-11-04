export function createWebhookEmailDelivery({ url, bearerToken }) {
  if (!url) {
    throw new Error('MAIL_WEBHOOK_URL is required to process the outbox.');
  }
  return Object.freeze({
    async send(message) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
          ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`Mail provider returned HTTP ${response.status}.`);
      }
    },
  });
}

export function createCaptureEmailDelivery() {
  const messages = [];
  return Object.freeze({
    messages,
    async send(message) {
      messages.push(JSON.parse(JSON.stringify(message)));
    },
  });
}
