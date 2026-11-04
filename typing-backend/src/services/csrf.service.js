import { Buffer } from 'node:buffer';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { AUTH } from '../constants/auth.js';
import { MESSAGES } from '../constants/messages.js';
import { InvalidCsrfError } from '../utils/app-error.js';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '', 'utf8');
  const rightBuffer = Buffer.from(right || '', 'utf8');
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createCsrfService({ secret, now }) {
  function sign(encodedPayload) {
    return createHmac('sha256', secret)
      .update(encodedPayload, 'utf8')
      .digest('base64url');
  }

  return Object.freeze({
    issue(sessionId = 'pre-auth') {
      const payload = Buffer.from(
        JSON.stringify({
          nonce: randomBytes(AUTH.csrfNonceBytes).toString('base64url'),
          sid: sessionId,
          iat: Math.floor(now().getTime() / 1000),
        }),
      ).toString('base64url');
      return `${payload}.${sign(payload)}`;
    },

    verify({ headerToken, cookieToken, expectedSessionId }) {
      if (!safeEqual(headerToken, cookieToken)) {
        throw new InvalidCsrfError(MESSAGES.invalidCsrf);
      }
      const [payload, signature, extra] = (headerToken || '').split('.');
      if (
        !payload ||
        !signature ||
        extra ||
        !safeEqual(signature, sign(payload))
      ) {
        throw new InvalidCsrfError(MESSAGES.invalidCsrf);
      }
      try {
        const parsed = JSON.parse(
          Buffer.from(payload, 'base64url').toString('utf8'),
        );
        if (
          typeof parsed.nonce !== 'string' ||
          typeof parsed.sid !== 'string' ||
          !Number.isInteger(parsed.iat) ||
          (expectedSessionId && parsed.sid !== expectedSessionId)
        ) {
          throw new Error('Invalid CSRF payload.');
        }
        return parsed;
      } catch (error) {
        if (error instanceof InvalidCsrfError) throw error;
        throw new InvalidCsrfError(MESSAGES.invalidCsrf);
      }
    },
  });
}
