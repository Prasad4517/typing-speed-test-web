'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Alert, Button, TextField } from '@/common-components';
import { ROUTES } from '@/constants/routes';
import { requestPasswordReset } from '@/services/auth.service';

import { AUTH_COPY, AUTH_VALIDATION, AUTH_VIEW } from './auth.constants';
import { AuthShell } from './auth-shell';
import {
  apiFieldErrors,
  validateConfirmation,
  validateEmail,
  validateFullName,
  validatePassword,
} from './auth-validation';
import { useAuth } from './auth-provider';
import { PasswordField } from './password-field';
import { safeReturnPath } from './safe-return-path';
import styles from './auth-page.module.scss';

const INITIAL_VALUES = Object.freeze({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
});

function getErrorMessage(error) {
  return (
    error?.message || 'We could not complete that request. Please try again.'
  );
}

function routeForView(view) {
  if (view === AUTH_VIEW.signUp) return ROUTES.signUp;
  if (view === AUTH_VIEW.forgotPassword) return ROUTES.forgotPassword;
  return ROUTES.signIn;
}

export function AuthPage({ view = AUTH_VIEW.signIn }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedView = Object.values(AUTH_VIEW).includes(view)
    ? view
    : AUTH_VIEW.signIn;
  const copy = AUTH_COPY.views[normalizedView];
  const isSignUp = normalizedView === AUTH_VIEW.signUp;
  const isForgotPassword = normalizedView === AUTH_VIEW.forgotPassword;
  const nextPath = useMemo(
    () => safeReturnPath(searchParams.get('next')),
    [searchParams],
  );

  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'password-reset') setNotice(AUTH_COPY.resetComplete);
    if (message === 'verified') {
      setNotice('Email verified — you can sign in now.');
    }
    if (message === 'password-changed') {
      setNotice('Password updated. Sign in again on this device.');
    }
    if (message === 'signed-out') {
      setNotice('You are signed out on every device.');
    }
  }, [searchParams]);

  function updateValue(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  }

  function validate() {
    const nextErrors = { email: validateEmail(values.email) };
    if (isSignUp) {
      nextErrors.fullName = validateFullName(values.fullName);
      nextErrors.password = validatePassword(values.password);
      nextErrors.confirmPassword = validateConfirmation(
        values.password,
        values.confirmPassword,
      );
    } else if (!isForgotPassword && !values.password) {
      nextErrors.password = 'Enter your password.';
    }
    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      if (isForgotPassword) {
        const result = await requestPasswordReset({
          email: values.email.trim(),
        });
        setNotice(
          result?.message ||
            'If that address can receive a reset, instructions are on the way.',
        );
        setValues(INITIAL_VALUES);
        return;
      }

      if (isSignUp) {
        await signUp({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          password: values.password,
        });
        router.push(ROUTES.verifyEmail);
        return;
      }

      await signIn({
        email: values.email.trim(),
        password: values.password,
      });
      router.replace(nextPath);
      router.refresh();
    } catch (requestError) {
      const backendErrors = apiFieldErrors(requestError);
      if (Object.keys(backendErrors).length) setErrors(backendErrors);
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      compact={isForgotPassword}
      description={copy.description}
      eyebrow={copy.eyebrow}
      title={copy.title}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        {isSignUp ? (
          <TextField
            autoComplete="name"
            error={errors.fullName}
            label={AUTH_COPY.fields.fullName}
            maxLength={AUTH_VALIDATION.fullNameMaxLength}
            name="fullName"
            onChange={updateValue}
            required
            value={values.fullName}
          />
        ) : null}
        <TextField
          autoComplete="email"
          error={errors.email}
          label={AUTH_COPY.fields.email}
          maxLength={AUTH_VALIDATION.emailMaxLength}
          name="email"
          onChange={updateValue}
          required
          type="email"
          value={values.email}
        />
        {!isForgotPassword ? (
          <PasswordField
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            error={errors.password}
            hint={isSignUp ? AUTH_COPY.passwordHint : undefined}
            label={AUTH_COPY.fields.password}
            maxLength={AUTH_VALIDATION.passwordMaxLength}
            minLength={isSignUp ? AUTH_VALIDATION.passwordMinLength : undefined}
            name="password"
            onChange={updateValue}
            required
            showStrength={isSignUp}
            value={values.password}
          />
        ) : null}
        {isSignUp ? (
          <PasswordField
            autoComplete="new-password"
            error={errors.confirmPassword}
            label={AUTH_COPY.fields.confirmPassword}
            maxLength={AUTH_VALIDATION.passwordMaxLength}
            minLength={AUTH_VALIDATION.passwordMinLength}
            name="confirmPassword"
            onChange={updateValue}
            required
            value={values.confirmPassword}
          />
        ) : null}

        {!isSignUp && !isForgotPassword ? (
          <div className={styles.formUtility}>
            <span>Use the email connected to your progress.</span>
            <Link href={ROUTES.forgotPassword}>Forgot password?</Link>
          </div>
        ) : null}

        <Button loading={isSubmitting} size="lg" type="submit">
          {copy.submit} <span aria-hidden="true">→</span>
        </Button>
      </form>

      <p className={styles.switchPrompt}>
        {isForgotPassword ? (
          <>
            Remembered it? <Link href={ROUTES.signIn}>Back to sign in</Link>
          </>
        ) : (
          <>
            {copy.switchPrompt}{' '}
            <Link
              href={routeForView(
                isSignUp ? AUTH_VIEW.signIn : AUTH_VIEW.signUp,
              )}
            >
              {copy.switchAction}
            </Link>
          </>
        )}
      </p>
    </AuthShell>
  );
}
