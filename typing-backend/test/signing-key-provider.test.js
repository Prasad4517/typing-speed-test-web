import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

import { config } from '../src/config/env.js';
import { createSigningKeyProvider } from '../src/services/signing-key-provider.js';

function pemPair() {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: pair.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString(),
    publicKey: pair.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString(),
  };
}

test('signing key provider supports process-local development keys', async () => {
  const provider = createSigningKeyProvider({
    ...config,
    isProduction: false,
    jwtPrivateKey: undefined,
    jwtPrivateKeyBase64: undefined,
    jwtPrivateKeyPath: undefined,
    jwtPublicKey: undefined,
    jwtPublicKeyBase64: undefined,
    jwtPublicKeyPath: undefined,
    jwtPublicKeysJson: undefined,
  });
  assert.ok(await provider.getSigningKey());
  assert.ok(await provider.getVerificationKey(provider.signingKid));
});

test('signing key provider accepts matching PEM and rejects a mismatched public key', () => {
  const active = pemPair();
  const other = pemPair();
  assert.doesNotThrow(() =>
    createSigningKeyProvider({
      ...config,
      jwtPrivateKey: active.privateKey,
      jwtPublicKey: active.publicKey,
      jwtPrivateKeyBase64: undefined,
      jwtPrivateKeyPath: undefined,
      jwtPublicKeyBase64: undefined,
      jwtPublicKeyPath: undefined,
      jwtPublicKeysJson: undefined,
    }),
  );
  assert.throws(
    () =>
      createSigningKeyProvider({
        ...config,
        jwtPrivateKey: active.privateKey,
        jwtPublicKey: other.publicKey,
        jwtPrivateKeyBase64: undefined,
        jwtPrivateKeyPath: undefined,
        jwtPublicKeyBase64: undefined,
        jwtPublicKeyPath: undefined,
        jwtPublicKeysJson: undefined,
      }),
    /does not match/,
  );
});
