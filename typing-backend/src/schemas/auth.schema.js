import { z } from 'zod';

const emailSchema = z
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
  .min(12, 'Password must contain at least 12 characters.')
  .max(128)
  .refine(
    (value) => value.trim().length >= 12,
    'Password must contain at least 12 non-space characters.',
  );

export const signUpBodySchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
  })
  .strict();

export const updateProfileBodySchema = z
  .object({ fullName: fullNameSchema })
  .strict();

export const loginBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const forgotPasswordBodySchema = z
  .object({ email: emailSchema })
  .strict();

export const resetPasswordBodySchema = z
  .object({
    token: z.string().min(40).max(256),
    password: newPasswordSchema,
  })
  .strict();
