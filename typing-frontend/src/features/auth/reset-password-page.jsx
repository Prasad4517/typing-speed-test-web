'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, TextField } from '@/common-components';
import { ROUTES } from '@/constants/routes';
import { resetPassword } from '@/services/auth.service';

import { AUTH_COPY, AUTH_VALIDATION } from './auth.constants';
import { AuthShell } from './auth-shell';
import {
  validateConfirmation,
  validatePassword,
  validateSecurityToken,
} from './auth-validation';
import { useAuth } from './auth-provider';
import { PasswordField } from './password-field';
import styles from './auth-page.module.scss';

export function ResetPasswordPage() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const [values, setValues] = useState({
    token: '',
    password: '',
    confirmation: '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateValue(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  }

  function validate() {
    const nextErrors = {
      token: validateSecurityToken(values.token, 'reset code'),
      password: validatePassword(values.password),
      confirmation: validateConfirmation(values.password, values.confirmation),
    };
    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setError('');
    setIsSubmitting(true);
    try {
      await resetPassword({
        token: values.token.trim(),
        newPassword: values.password,
      });
      clearSession();
      router.replace(`${ROUTES.signIn}?message=password-reset`);
    } catch (requestError) {
      setError(
        requestError?.message ||
          'We could not reset your password. Request a fresh code and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      compact
      description="Paste the reset code from your email, then choose a new password you do not use anywhere else."
      eyebrow="Secure account recovery"
      title="Choose a new password."
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <div className={styles.tokenNote}>
          <span aria-hidden="true">⌁</span>
          <span>
            Reset codes are intentionally{' '}
            <strong>never read from the URL</strong>.
          </span>
        </div>
        <TextField
          autoCapitalize="none"
          autoComplete="one-time-code"
          error={errors.token}
          label="Password reset code"
          maxLength={AUTH_VALIDATION.tokenMaxLength}
          name="token"
          onChange={updateValue}
          placeholder="Paste the code from your email"
          required
          spellCheck={false}
          value={values.token}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.password}
          label="New password"
          maxLength={AUTH_VALIDATION.passwordMaxLength}
          minLength={AUTH_VALIDATION.passwordMinLength}
          name="password"
          onChange={updateValue}
          required
          showStrength
          value={values.password}
        />
        <PasswordField
          autoComplete="new-password"
          error={errors.confirmation}
          label={AUTH_COPY.fields.confirmPassword}
          maxLength={AUTH_VALIDATION.passwordMaxLength}
          minLength={AUTH_VALIDATION.passwordMinLength}
          name="confirmation"
          onChange={updateValue}
          required
          value={values.confirmation}
        />
        <Button loading={isSubmitting} size="lg" type="submit">
          Set new password <span aria-hidden="true">→</span>
        </Button>
      </form>
      <p className={styles.switchPrompt}>
        Need another code?{' '}
        <Link href={ROUTES.forgotPassword}>Request a new reset</Link>
      </p>
    </AuthShell>
  );
}
