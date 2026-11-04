import { createHash } from 'node:crypto';

import { createClient } from 'redis';

import { MESSAGES } from '../constants/messages.js';
import {
  DependencyUnavailableError,
  RateLimitError,
} from '../utils/app-error.js';

const LUA_INCREMENT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

function hashed(value) {
  return createHash('sha256')
    .update(value || 'none')
    .digest('hex');
}

function keysFor({ action, ipAddress, identifier }) {
  return [
    `auth-limit:${action}:ip:${hashed(ipAddress)}`,
    ...(identifier
      ? [`auth-limit:${action}:account:${hashed(identifier)}`]
      : []),
  ];
}

function enforceResult(result, limit) {
  const count = Number(result[0]);
  const ttl = Math.max(0, Number(result[1]));
  if (count > limit) {
    throw new RateLimitError(
      MESSAGES.rateLimited,
      Math.max(1, Math.ceil(ttl / 1000)),
    );
  }
}

export function createRedisRateLimiter({ url, onError = () => {} }) {
  const client = createClient({
    url,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy(retries) {
        if (retries >= 3) return new Error('Redis reconnect limit reached.');
        return Math.min(1000, (retries + 1) * 200);
      },
    },
  });
  client.on('error', onError);

  return Object.freeze({
    async start() {
      if (!client.isOpen) await client.connect();
    },
    async close() {
      if (client.isOpen) await client.close();
    },
    async checkAvailability() {
      if (!client.isReady) {
        throw new DependencyUnavailableError(MESSAGES.dependencyUnavailable);
      }
      await client.ping();
    },
    async check({ action, ipAddress, identifier, limit, windowMs }) {
      if (!client.isReady) {
        throw new DependencyUnavailableError(MESSAGES.dependencyUnavailable);
      }
      try {
        for (const key of keysFor({ action, ipAddress, identifier })) {
          const result = await client.eval(LUA_INCREMENT, {
            keys: [key],
            arguments: [String(windowMs)],
          });
          enforceResult(result, limit);
        }
      } catch (error) {
        if (error instanceof RateLimitError) throw error;
        onError(error);
        throw new DependencyUnavailableError(MESSAGES.dependencyUnavailable);
      }
    },
  });
}

export function createMemoryRateLimiter({ now = () => Date.now() } = {}) {
  const entries = new Map();
  return Object.freeze({
    async start() {},
    async close() {
      entries.clear();
    },
    async checkAvailability() {},
    async check({ action, ipAddress, identifier, limit, windowMs }) {
      const currentTime = now();
      for (const key of keysFor({ action, ipAddress, identifier })) {
        const existing = entries.get(key);
        const entry =
          !existing || existing.expiresAt <= currentTime
            ? { count: 0, expiresAt: currentTime + windowMs }
            : existing;
        entry.count += 1;
        entries.set(key, entry);
        enforceResult([entry.count, entry.expiresAt - currentTime], limit);
      }
    },
  });
}
