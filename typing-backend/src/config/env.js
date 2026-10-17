import 'dotenv/config';
import { URL } from 'node:url';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  CORS_ORIGIN: z.string().refine(
    (value) =>
      value.split(',').every((origin) => {
        try {
          const parsed = new URL(origin.trim());
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      }),
    { message: 'CORS_ORIGIN must contain valid comma-separated URLs.' },
  ),
  RATE_LIMIT_MAX: z.coerce.number().int().positive(),
  RATE_LIMIT_WINDOW: z.string().min(1),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith('mysql://'), {
      message: 'DATABASE_URL must use the mysql:// protocol.',
    }),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive(),
  TRUST_PROXY: z.enum(['true', 'false']),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive(),
  TIMING_TOLERANCE_MS: z.coerce.number().int().nonnegative(),
  MIN_ELAPSED_MS: z.coerce.number().int().positive(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).max(120),
  JWT_AUDIENCE: z.string().min(1).max(120),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440),
  AUTH_COOKIE_SECURE: z.enum(['true', 'false']),
});

const environmentSchema = envSchema.superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.AUTH_COOKIE_SECURE !== 'true') {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_COOKIE_SECURE'],
      message: 'AUTH_COOKIE_SECURE must be true in production.',
    });
  }

  if (
    value.NODE_ENV === 'production' &&
    value.JWT_ACCESS_SECRET.includes('development-only')
  ) {
    context.addIssue({
      code: 'custom',
      path: ['JWT_ACCESS_SECRET'],
      message: 'JWT_ACCESS_SECRET must be replaced with a production secret.',
    });
  }
});

const parsedEnv = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,
  DATABASE_URL: process.env.DATABASE_URL,
  DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT,
  TRUST_PROXY: process.env.TRUST_PROXY,
  SESSION_TTL_SECONDS: process.env.SESSION_TTL_SECONDS,
  TIMING_TOLERANCE_MS: process.env.TIMING_TOLERANCE_MS,
  MIN_ELAPSED_MS: process.env.MIN_ELAPSED_MS,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ISSUER: process.env.JWT_ISSUER,
  JWT_AUDIENCE: process.env.JWT_AUDIENCE,
  ACCESS_TOKEN_TTL_SECONDS: process.env.ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS: process.env.REFRESH_TOKEN_TTL_DAYS,
  PASSWORD_RESET_TTL_MINUTES: process.env.PASSWORD_RESET_TTL_MINUTES,
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
});

if (!parsedEnv.success) {
  console.error('Invalid backend environment configuration.');
  console.error(parsedEnv.error.issues);
  process.exit(1);
}

export const config = Object.freeze({
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  corsOrigin: parsedEnv.data.CORS_ORIGIN,
  corsOrigins: Object.freeze([
    ...new Set([
      ...parsedEnv.data.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]),
  ]),
  rateLimitMax: parsedEnv.data.RATE_LIMIT_MAX,
  rateLimitWindow: parsedEnv.data.RATE_LIMIT_WINDOW,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  dbConnectionLimit: parsedEnv.data.DB_CONNECTION_LIMIT,
  trustProxy: parsedEnv.data.TRUST_PROXY === 'true',
  sessionTtlSeconds: parsedEnv.data.SESSION_TTL_SECONDS,
  timingToleranceMs: parsedEnv.data.TIMING_TOLERANCE_MS,
  minElapsedMs: parsedEnv.data.MIN_ELAPSED_MS,
  jwtAccessSecret: parsedEnv.data.JWT_ACCESS_SECRET,
  jwtIssuer: parsedEnv.data.JWT_ISSUER,
  jwtAudience: parsedEnv.data.JWT_AUDIENCE,
  accessTokenTtlSeconds: parsedEnv.data.ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlDays: parsedEnv.data.REFRESH_TOKEN_TTL_DAYS,
  passwordResetTtlMinutes: parsedEnv.data.PASSWORD_RESET_TTL_MINUTES,
  authCookieSecure: parsedEnv.data.AUTH_COOKIE_SECURE === 'true',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
});
