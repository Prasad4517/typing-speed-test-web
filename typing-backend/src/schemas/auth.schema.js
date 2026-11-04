import { z } from 'zod';

import { config } from '../config/env.js';

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(254)
  .transform((value) => value.toLowerCase());

const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Full name must contain at least 2 characters.')
  .max(150)
  .regex(
    /^[\p{L}][\p{L}\s.'-]*$/u,
    'Full name contains unsupported characters.',
  );

const newPasswordSchema = z
  .string()
  .min(
    config.passwordMinLength,
    `Password must contain at least ${config.passwordMinLength} characters.`,
  )
  .max(config.passwordMaxLength)
  .refine(
    (value) => value.trim().length >= config.passwordMinLength,
    `Password must contain at least ${config.passwordMinLength} non-space characters.`,
  );

const tokenSchema = z
  .string()
  .min(40)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/, 'Token encoding is invalid.');

export const signUpBodySchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
  })
  .strict();

export const signInBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(config.passwordMaxLength),
    deviceLabel: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const updateProfileBodySchema = z
  .object({ fullName: fullNameSchema })
  .strict();

export const verifyEmailBodySchema = z.object({ token: tokenSchema }).strict();

export const resendVerificationBodySchema = z
  .object({ email: emailSchema })
  .strict();

export const forgotPasswordBodySchema = z
  .object({ email: emailSchema })
  .strict();

export const resetPasswordBodySchema = z
  .object({
    token: tokenSchema,
    newPassword: newPasswordSchema,
  })
  .strict();

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(config.passwordMaxLength),
    newPassword: newPasswordSchema,
  })
  .strict();

export const sessionParamsSchema = z
  .object({ sessionId: z.string().uuid() })
  .strict();

export const sessionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().uuid().optional(),
  })
  .strict();
