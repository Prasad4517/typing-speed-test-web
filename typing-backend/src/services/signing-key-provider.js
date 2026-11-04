import { Buffer } from 'node:buffer';
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from 'node:crypto';
import { readFileSync } from 'node:fs';

import { importPKCS8, importSPKI } from 'jose';

import { AUTH } from '../constants/auth.js';

let developmentKeyPair;

function readConfiguredValue({ inline, base64, path }) {
  if (inline) return inline.replace(/\\n/g, '\n');
  if (base64) return Buffer.from(base64, 'base64').toString('utf8');
  if (path) return readFileSync(path, 'utf8');
  return null;
}

function normalizePrivatePem(value) {
  const key = value?.type === 'private' ? value : createPrivateKey(value);
  return key.export({ type: 'pkcs8', format: 'pem' }).toString();
}

function normalizePublicPem(value) {
  const key = value?.type === 'public' ? value : createPublicKey(value);
  return key.export({ type: 'spki', format: 'pem' }).toString();
}

function ephemeralKeys() {
  if (!developmentKeyPair) {
    const generated = generateKeyPairSync('rsa', { modulusLength: 2048 });
    developmentKeyPair = {
      privateKey: generated.privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString(),
      publicKey: generated.publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString(),
    };
  }
  return developmentKeyPair;
}

function parsePublicKeyValue(value) {
  if (typeof value === 'string') {
    if (value.startsWith('base64:')) {
      return Buffer.from(value.slice(7), 'base64').toString('utf8');
    }
    if (value.startsWith('file:')) return readFileSync(value.slice(5), 'utf8');
    return value.replace(/\\n/g, '\n');
  }
  if (value && typeof value === 'object') {
    return readConfiguredValue({
      inline: value.pem,
      base64: value.base64,
      path: value.path,
    });
  }
  throw new Error('JWT_PUBLIC_KEYS_JSON contains an invalid key source.');
}

export function createSigningKeyProvider(config) {
  let privatePem = readConfiguredValue({
    inline: config.jwtPrivateKey,
    base64: config.jwtPrivateKeyBase64,
    path: config.jwtPrivateKeyPath,
  });
  let publicPem = readConfiguredValue({
    inline: config.jwtPublicKey,
    base64: config.jwtPublicKeyBase64,
    path: config.jwtPublicKeyPath,
  });

  if (!privatePem) {
    if (config.isProduction) {
      throw new Error('A production JWT signing key is required.');
    }
    const generated = ephemeralKeys();
    privatePem = generated.privateKey;
    publicPem = publicPem || generated.publicKey;
  }

  const privateKeyObject = createPrivateKey(privatePem);
  if (
    !['rsa', 'rsa-pss'].includes(privateKeyObject.asymmetricKeyType) ||
    (privateKeyObject.asymmetricKeyDetails?.modulusLength || 0) < 2048
  ) {
    throw new Error('JWT signing requires an RSA key of at least 2048 bits.');
  }
  privatePem = normalizePrivatePem(privateKeyObject);
  const derivedPublicPem = normalizePublicPem(
    createPublicKey(privateKeyObject),
  );
  if (publicPem && normalizePublicPem(publicPem) !== derivedPublicPem) {
    throw new Error(
      'The active JWT public key does not match the private key.',
    );
  }
  publicPem = derivedPublicPem;

  const publicPems = new Map([[config.jwtSigningKid, publicPem]]);
  if (config.jwtPublicKeysJson) {
    let parsed;
    try {
      parsed = JSON.parse(config.jwtPublicKeysJson);
    } catch {
      throw new Error('JWT_PUBLIC_KEYS_JSON must be valid JSON.');
    }
    for (const [kid, source] of Object.entries(parsed)) {
      if (!/^[A-Za-z0-9._-]{1,80}$/.test(kid)) {
        throw new Error('JWT_PUBLIC_KEYS_JSON contains an invalid kid.');
      }
      const normalized = normalizePublicPem(parsePublicKeyValue(source));
      if (kid === config.jwtSigningKid && normalized !== derivedPublicPem) {
        throw new Error(
          'The active kid in JWT_PUBLIC_KEYS_JSON conflicts with the signing key.',
        );
      }
      publicPems.set(kid, normalized);
    }
  }

  if (!publicPems.has(config.jwtSigningKid)) {
    throw new Error(
      'The active signing kid is missing from the public key set.',
    );
  }

  const signingKeyPromise = importPKCS8(privatePem, AUTH.accessTokenAlgorithm);
  const verificationKeyPromises = new Map(
    [...publicPems].map(([kid, pem]) => [
      kid,
      importSPKI(pem, AUTH.accessTokenAlgorithm),
    ]),
  );

  return Object.freeze({
    signingKid: config.jwtSigningKid,
    getSigningKey: () => signingKeyPromise,
    getVerificationKey(kid) {
      return verificationKeyPromises.get(kid) || null;
    },
  });
}
