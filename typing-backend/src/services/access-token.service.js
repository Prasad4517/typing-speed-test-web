import { randomUUID } from 'node:crypto';

import { decodeProtectedHeader, jwtVerify, SignJWT } from 'jose';

import { AUTH } from '../constants/auth.js';
import { MESSAGES } from '../constants/messages.js';
import { UnauthorizedError } from '../utils/app-error.js';

function numericDate(date) {
  return Math.floor(date.getTime() / 1000);
}

export function createAccessTokenService({ config, keyProvider, now }) {
  return Object.freeze({
    async issue({ userId, sessionId, roles, securityVersion }) {
      const issuedAt = numericDate(now());
      return new SignJWT({
        roles,
        sid: sessionId,
        sv: securityVersion,
        token_use: AUTH.accessTokenUse,
      })
        .setProtectedHeader({
          alg: AUTH.accessTokenAlgorithm,
          kid: keyProvider.signingKid,
          typ: AUTH.accessTokenType,
        })
        .setIssuer(config.jwtIssuer)
        .setAudience(config.jwtAudience)
        .setSubject(userId)
        .setJti(randomUUID())
        .setIssuedAt(issuedAt)
        .setNotBefore(issuedAt)
        .setExpirationTime(issuedAt + config.accessTokenTtlSeconds)
        .sign(await keyProvider.getSigningKey());
    },

    async verify(token) {
      if (!token) throw new UnauthorizedError(MESSAGES.unauthorized);
      try {
        const header = decodeProtectedHeader(token);
        if (
          header.alg !== AUTH.accessTokenAlgorithm ||
          header.typ !== AUTH.accessTokenType ||
          typeof header.kid !== 'string'
        ) {
          throw new Error('Unexpected access-token header.');
        }
        const key = keyProvider.getVerificationKey(header.kid);
        if (!key) throw new Error('Unknown signing key.');
        const { payload } = await jwtVerify(token, await key, {
          algorithms: [AUTH.accessTokenAlgorithm],
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
          clockTolerance: config.jwtClockSkewSeconds,
          requiredClaims: [
            'iss',
            'sub',
            'aud',
            'iat',
            'nbf',
            'exp',
            'jti',
            'sid',
            'roles',
            'sv',
            'token_use',
          ],
        });
        if (
          payload.token_use !== AUTH.accessTokenUse ||
          typeof payload.sub !== 'string' ||
          typeof payload.sid !== 'string' ||
          typeof payload.jti !== 'string' ||
          !Array.isArray(payload.roles) ||
          !payload.roles.every((role) => typeof role === 'string') ||
          !Number.isInteger(payload.sv)
        ) {
          throw new Error('Invalid access-token claims.');
        }
        return payload;
      } catch {
        throw new UnauthorizedError(MESSAGES.unauthorized);
      }
    },
  });
}
