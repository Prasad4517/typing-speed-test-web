import './load-env.js';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';

import { z } from 'zod';

const booleanString = z.enum(['true', 'false']);
const optionalString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  z.string().optional(),
);

function validOrigins(value) {
  return value.split(',').every((origin) => {
    try {
      const parsed = new URL(origin.trim());
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  });
}

const rawCorsOrigins =
  process.env.CORS_ALLOWED_ORIGINS ||
  process.env.CORS_ORIGIN ||
  'http://localhost:3000,http://127.0.0.1:3000';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .refine(validOrigins, 'CORS_ALLOWED_ORIGINS must contain valid URLs.'),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW: z.string().min(1).default('1 minute'),
    DATABASE_URL: z.string().url(),
    DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
    REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
    TRUST_PROXY: booleanString.default('false'),
    TRUST_PROXY_HOPS: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().min(1).max(10).optional(),
    ),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    TIMING_TOLERANCE_MS: z.coerce.number().int().nonnegative().default(5000),
    MIN_ELAPSED_MS: z.coerce.number().int().positive().default(500),
    JWT_ISSUER: z.string().min(1).max(120).default('keystroke-api'),
    JWT_AUDIENCE: z.string().min(1).max(120).default('keystroke-web'),
    JWT_SIGNING_KID: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,80}$/)
      .default('dev-1'),
    JWT_PRIVATE_KEY: optionalString,
    JWT_PRIVATE_KEY_BASE64: optionalString,
    JWT_PRIVATE_KEY_PATH: optionalString,
    JWT_PUBLIC_KEY: optionalString,
    JWT_PUBLIC_KEY_BASE64: optionalString,
    JWT_PUBLIC_KEY_PATH: optionalString,
    JWT_PUBLIC_KEYS_JSON: optionalString,
    JWT_CLOCK_SKEW_SECONDS: z.coerce.number().int().min(0).max(120).default(5),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(600),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    EMAIL_VERIFICATION_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(1440)
      .default(30),
    PASSWORD_RESET_TTL_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(1440)
      .default(30),
    PASSWORD_MIN_LENGTH: z.coerce.number().int().min(10).max(128).default(12),
    PASSWORD_MAX_LENGTH: z.coerce.number().int().min(64).max(1024).default(256),
    LOCKOUT_THRESHOLD: z.coerce.number().int().min(3).max(50).default(5),
    LOCKOUT_SECONDS: z.coerce.number().int().min(30).max(86400).default(900),
    AUTH_COOKIE_SECURE: booleanString.default('false'),
    AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('lax'),
    AUTH_COOKIE_DOMAIN: optionalString,
    CSRF_SIGNING_SECRET: optionalString,
    OUTBOX_ENCRYPTION_KEY_BASE64: optionalString,
    MAIL_WEBHOOK_URL: optionalString.refine(
      (value) => !value || URL.canParse(value),
      'MAIL_WEBHOOK_URL must be a valid URL.',
    ),
    MAIL_WEBHOOK_BEARER_TOKEN: optionalString,
    OUTBOX_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(500)
      .max(60000)
      .default(5000),
    SECURITY_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(14)
      .max(3650)
      .default(30),
    AUDIT_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(30)
      .max(3650)
      .default(180),
    OUTBOX_RETENTION_DAYS: z.coerce.number().int().min(7).max(365).default(30),
    CLEANUP_BATCH_SIZE: z.coerce.number().int().min(10).max(5000).default(500),
    FRONTEND_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  })
  .superRefine((value, context) => {
    const isProduction = value.NODE_ENV === 'production';

    if (!/^mysql:\/\//.test(value.DATABASE_URL)) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message:
          'DATABASE_URL must use the mysql:// protocol for MariaDB/MySQL.',
      });
    }

    if (
      value.AUTH_COOKIE_SAMESITE === 'none' &&
      value.AUTH_COOKIE_SECURE !== 'true'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'Cross-site cookies require AUTH_COOKIE_SECURE=true.',
      });
    }

    if (isProduction) {
      if (value.TRUST_PROXY === 'true' && !value.TRUST_PROXY_HOPS) {
        context.addIssue({
          code: 'custom',
          path: ['TRUST_PROXY_HOPS'],
          message: 'Production proxy trust must use an explicit hop count.',
        });
      }
      if (!process.env.CORS_ALLOWED_ORIGINS && !process.env.CORS_ORIGIN) {
        context.addIssue({
          code: 'custom',
          path: ['CORS_ALLOWED_ORIGINS'],
          message: 'Production requires an explicit CORS allowlist.',
        });
      }
      if (!process.env.FRONTEND_PUBLIC_URL) {
        context.addIssue({
          code: 'custom',
          path: ['FRONTEND_PUBLIC_URL'],
          message: 'Production requires FRONTEND_PUBLIC_URL.',
        });
      }
      const insecureOrigins = value.CORS_ALLOWED_ORIGINS.split(',').filter(
        (origin) => !origin.trim().startsWith('https://'),
      );
      if (
        insecureOrigins.length ||
        !value.FRONTEND_PUBLIC_URL.startsWith('https://')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['CORS_ALLOWED_ORIGINS'],
          message: 'Production browser URLs must use HTTPS.',
        });
      }
      if (value.AUTH_COOKIE_SECURE !== 'true') {
        context.addIssue({
          code: 'custom',
          path: ['AUTH_COOKIE_SECURE'],
          message: 'AUTH_COOKIE_SECURE must be true in production.',
        });
      }
      if (!value.CSRF_SIGNING_SECRET || value.CSRF_SIGNING_SECRET.length < 32) {
        context.addIssue({
          code: 'custom',
          path: ['CSRF_SIGNING_SECRET'],
          message: 'CSRF_SIGNING_SECRET must contain at least 32 characters.',
        });
      }
      if (!value.OUTBOX_ENCRYPTION_KEY_BASE64) {
        context.addIssue({
          code: 'custom',
          path: ['OUTBOX_ENCRYPTION_KEY_BASE64'],
          message: 'Production requires OUTBOX_ENCRYPTION_KEY_BASE64.',
        });
      } else if (
        Buffer.from(value.OUTBOX_ENCRYPTION_KEY_BASE64, 'base64').length !== 32
      ) {
        context.addIssue({
          code: 'custom',
          path: ['OUTBOX_ENCRYPTION_KEY_BASE64'],
          message: 'OUTBOX_ENCRYPTION_KEY_BASE64 must decode to 32 bytes.',
        });
      }
      if (!value.MAIL_WEBHOOK_URL) {
        context.addIssue({
          code: 'custom',
          path: ['MAIL_WEBHOOK_URL'],
          message: 'Production requires MAIL_WEBHOOK_URL.',
        });
      }
      if (
        value.MAIL_WEBHOOK_URL &&
        !value.MAIL_WEBHOOK_URL.startsWith('https://')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['MAIL_WEBHOOK_URL'],
          message: 'MAIL_WEBHOOK_URL must use HTTPS in production.',
        });
      }
      if (
        !value.JWT_PRIVATE_KEY &&
        !value.JWT_PRIVATE_KEY_BASE64 &&
        !value.JWT_PRIVATE_KEY_PATH
      ) {
        context.addIssue({
          code: 'custom',
          path: ['JWT_PRIVATE_KEY'],
          message: 'Production requires an external JWT private key.',
        });
      }
    }
  });

const parsedEnv = envSchema.safeParse({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ALLOWED_ORIGINS: rawCorsOrigins,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'mysql://keystroke:keystroke@127.0.0.1:3306/keystroke',
});

if (!parsedEnv.success) {
  console.error('Invalid backend environment configuration.');
  console.error(parsedEnv.error.issues);
  process.exit(1);
}

const env = parsedEnv.data;
const isTest = env.NODE_ENV === 'test';
const processLocalCsrfSecret = randomBytes(48).toString('base64url');
const processLocalOutboxKey = randomBytes(32);

export const config = Object.freeze({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  corsOrigin: env.CORS_ALLOWED_ORIGINS,
  corsOrigins: Object.freeze([
    ...new Set(
      env.CORS_ALLOWED_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ]),
  rateLimitMax: env.RATE_LIMIT_MAX,
  rateLimitWindow: env.RATE_LIMIT_WINDOW,
  databaseUrl: env.DATABASE_URL,
  dbConnectionLimit: env.DB_CONNECTION_LIMIT,
  redisUrl: env.REDIS_URL,
  trustProxy:
    env.TRUST_PROXY_HOPS ||
    (env.TRUST_PROXY === 'true' && env.NODE_ENV !== 'production'),
  sessionTtlSeconds: env.SESSION_TTL_SECONDS,
  timingToleranceMs: env.TIMING_TOLERANCE_MS,
  minElapsedMs: env.MIN_ELAPSED_MS,
  jwtIssuer: env.JWT_ISSUER,
  jwtAudience: env.JWT_AUDIENCE,
  jwtSigningKid: env.JWT_SIGNING_KID,
  jwtPrivateKey: env.JWT_PRIVATE_KEY,
  jwtPrivateKeyBase64: env.JWT_PRIVATE_KEY_BASE64,
  jwtPrivateKeyPath: env.JWT_PRIVATE_KEY_PATH,
  jwtPublicKey: env.JWT_PUBLIC_KEY,
  jwtPublicKeyBase64: env.JWT_PUBLIC_KEY_BASE64,
  jwtPublicKeyPath: env.JWT_PUBLIC_KEY_PATH,
  jwtPublicKeysJson: env.JWT_PUBLIC_KEYS_JSON,
  jwtClockSkewSeconds: env.JWT_CLOCK_SKEW_SECONDS,
  accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  emailVerificationTtlMinutes: env.EMAIL_VERIFICATION_TTL_MINUTES,
  passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  passwordMinLength: env.PASSWORD_MIN_LENGTH,
  passwordMaxLength: env.PASSWORD_MAX_LENGTH,
  lockoutThreshold: env.LOCKOUT_THRESHOLD,
  lockoutSeconds: env.LOCKOUT_SECONDS,
  authCookieSecure: env.AUTH_COOKIE_SECURE === 'true',
  authCookieSameSite: env.AUTH_COOKIE_SAMESITE,
  authCookieDomain: env.AUTH_COOKIE_DOMAIN,
  csrfSigningSecret: env.CSRF_SIGNING_SECRET || processLocalCsrfSecret,
  outboxEncryptionKey: env.OUTBOX_ENCRYPTION_KEY_BASE64
    ? Buffer.from(env.OUTBOX_ENCRYPTION_KEY_BASE64, 'base64')
    : processLocalOutboxKey,
  mailWebhookUrl: env.MAIL_WEBHOOK_URL,
  mailWebhookBearerToken: env.MAIL_WEBHOOK_BEARER_TOKEN,
  outboxPollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
  securityRetentionDays: env.SECURITY_RETENTION_DAYS,
  auditRetentionDays: env.AUDIT_RETENTION_DAYS,
  outboxRetentionDays: env.OUTBOX_RETENTION_DAYS,
  cleanupBatchSize: env.CLEANUP_BATCH_SIZE,
  frontendPublicUrl: env.FRONTEND_PUBLIC_URL,
  isTest,
  isProduction: env.NODE_ENV === 'production',
});
