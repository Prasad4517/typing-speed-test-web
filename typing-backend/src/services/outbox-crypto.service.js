import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function createOutboxCryptoService(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('The outbox encryption key must contain exactly 32 bytes.');
  }

  return Object.freeze({
    encrypt(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(value, 'utf8'),
        cipher.final(),
      ]);
      return {
        version: 1,
        algorithm: ALGORITHM,
        iv: iv.toString('base64url'),
        tag: cipher.getAuthTag().toString('base64url'),
        ciphertext: ciphertext.toString('base64url'),
      };
    },

    decrypt(envelope) {
      if (envelope?.version !== 1 || envelope?.algorithm !== ALGORITHM) {
        throw new Error('Unsupported outbox encryption envelope.');
      }
      const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(envelope.iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  });
}
