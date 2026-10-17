'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert, Button, Card, Container, TextField } from '@/common-components';
import { ROUTES } from '@/constants/routes';
import { requestPasswordReset } from '@/services/auth.service';

import { AUTH_COPY, AUTH_VALIDATION, AUTH_VIEW } from './auth.constants';
import { useAuth } from './auth-provider';
import styles from './auth-page.module.scss';

const INITIAL_VALUES = Object.freeze({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
});

function safeNextPath(value) {
  return typeof value === 'string' && /^\/(?!\/)/.test(value)
    ? value
    : ROUTES.home;
}

function getErrorMessage(error) {
  return (
    error?.message || 'We could not complete that request. Please try again.'
  );
}

export function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [view, setView] = useState(AUTH_VIEW.signIn);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fall back to the default screen during Fast Refresh or if an invalid view
  // value is ever introduced. The page must remain usable rather than crash.
  const copy = AUTH_COPY.views[view] ?? AUTH_COPY.views[AUTH_VIEW.signIn];
  const isSignUp = view === AUTH_VIEW.signUp;
  const isForgotPassword = view === AUTH_VIEW.forgotPassword;

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setNotice(AUTH_COPY.resetComplete);
    }
  }, [searchParams]);

  function updateValue(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function switchView(nextView) {
    setView(nextView);
    setError('');
    setNotice('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (isSignUp && values.password !== values.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isForgotPassword) {
        const result = await requestPasswordReset({ email: values.email });
        setNotice(result.message);
        return;
      }

      const payload = isSignUp
        ? {
            fullName: values.fullName,
            email: values.email,
            password: values.password,
          }
        : { email: values.email, password: values.password };
      const user = isSignUp ? await signUp(payload) : await signIn(payload);
      const destination = safeNextPath(searchParams.get('next'));
      router.replace(destination);
      router.refresh();
      return user;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Container size="sm">
        <Card className={styles.card}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {notice ? <Alert tone="success">{notice}</Alert> : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            {isSignUp ? (
              <TextField
                autoComplete="name"
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
              label={AUTH_COPY.fields.email}
              maxLength={AUTH_VALIDATION.emailMaxLength}
              name="email"
              onChange={updateValue}
              required
              type="email"
              value={values.email}
            />
            {!isForgotPassword ? (
              <TextField
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                hint={isSignUp ? AUTH_COPY.passwordHint : undefined}
                label={AUTH_COPY.fields.password}
                maxLength={AUTH_VALIDATION.passwordMaxLength}
                minLength={
                  isSignUp ? AUTH_VALIDATION.passwordMinLength : undefined
                }
                name="password"
                onChange={updateValue}
                required
                type="password"
                value={values.password}
              />
            ) : null}
            {isSignUp ? (
              <TextField
                autoComplete="new-password"
                label={AUTH_COPY.fields.confirmPassword}
                maxLength={AUTH_VALIDATION.passwordMaxLength}
                minLength={AUTH_VALIDATION.passwordMinLength}
                name="confirmPassword"
                onChange={updateValue}
                required
                type="password"
                value={values.confirmPassword}
              />
            ) : null}

            <Button loading={isSubmitting} type="submit">
              {copy.submit}
            </Button>
          </form>

          {view === AUTH_VIEW.signIn ? (
            <button
              className={styles.textAction}
              onClick={() => switchView(AUTH_VIEW.forgotPassword)}
              type="button"
            >
              {AUTH_COPY.forgotPasswordAction}
            </button>
          ) : null}
          {isForgotPassword ? (
            <button
              className={styles.textAction}
              onClick={() => switchView(AUTH_VIEW.signIn)}
              type="button"
            >
              {AUTH_COPY.backToSignIn}
            </button>
          ) : (
            <p className={styles.switchPrompt}>
              {copy.switchPrompt}{' '}
              <button
                className={styles.inlineAction}
                onClick={() =>
                  switchView(isSignUp ? AUTH_VIEW.signIn : AUTH_VIEW.signUp)
                }
                type="button"
              >
                {copy.switchAction}
              </button>
            </p>
          )}
        </Card>
      </Container>
    </div>
  );
}
