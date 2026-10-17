'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, Card, Container, TextField } from '@/common-components';
import { ROUTES } from '@/constants/routes';
import { resetPassword } from '@/services/auth.service';

import { AUTH_COPY, AUTH_VALIDATION } from './auth.constants';
import styles from './auth-page.module.scss';

export function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = searchParams.get('token') || '';
  const validToken = token.length >= 40;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!validToken) {
      setError('This password reset link is invalid or incomplete.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({ token, password });
      router.replace(`${ROUTES.signIn}?reset=success`);
    } catch (requestError) {
      setError(requestError?.message || 'We could not reset your password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Container size="sm">
        <Card className={styles.card}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>Account recovery</p>
            <h1>Choose a new password.</h1>
            <p>Use a unique password with at least 12 characters.</p>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <form className={styles.form} onSubmit={handleSubmit}>
            <TextField
              autoComplete="new-password"
              label="New password"
              maxLength={AUTH_VALIDATION.passwordMaxLength}
              minLength={AUTH_VALIDATION.passwordMinLength}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <TextField
              autoComplete="new-password"
              label={AUTH_COPY.fields.confirmPassword}
              maxLength={AUTH_VALIDATION.passwordMaxLength}
              minLength={AUTH_VALIDATION.passwordMinLength}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
            <Button disabled={!validToken} loading={isSubmitting} type="submit">
              Reset password
            </Button>
          </form>
        </Card>
      </Container>
    </div>
  );
}
