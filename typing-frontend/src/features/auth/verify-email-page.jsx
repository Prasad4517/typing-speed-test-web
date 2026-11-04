'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert, Button, TextField } from '@/common-components';
import { ROUTES } from '@/constants/routes';
import { resendVerification, verifyEmail } from '@/services/auth.service';

import { AUTH_VALIDATION } from './auth.constants';
import { AuthShell } from './auth-shell';
import { validateEmail, validateSecurityToken } from './auth-validation';
import styles from './auth-page.module.scss';

export function VerifyEmailPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleVerify(event) {
    event.preventDefault();
    if (isVerifying) return;
    const validationError = validateSecurityToken(token, 'verification code');
    setTokenError(validationError);
    if (validationError) return;

    setError('');
    setNotice('');
    setIsVerifying(true);
    try {
      await verifyEmail({ token: token.trim() });
      router.replace(`${ROUTES.signIn}?message=verified`);
    } catch (requestError) {
      setError(
        requestError?.message ||
          'That verification code is invalid or has expired.',
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend(event) {
    event.preventDefault();
    if (isResending) return;
    const validationError = validateEmail(email);
    setEmailError(validationError);
    if (validationError) return;

    setError('');
    setNotice('');
    setIsResending(true);
    try {
      const result = await resendVerification({ email: email.trim() });
      setNotice(
        result?.message ||
          'If verification is available, a fresh code is on the way.',
      );
    } catch (requestError) {
      setError(
        requestError?.message || 'We could not request another code just now.',
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthShell
      compact
      description="Paste the one-time code from your inbox. Keeping it out of the URL protects it from browser history and link previews."
      eyebrow="One quick checkpoint"
      title="Verify your email."
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <form className={styles.form} noValidate onSubmit={handleVerify}>
        <div className={styles.tokenNote}>
          <span aria-hidden="true">✦</span>
          <span>
            <strong>Your code stays private.</strong> Paste it here only — never
            share it in a message or screenshot.
          </span>
        </div>
        <TextField
          autoCapitalize="none"
          autoComplete="one-time-code"
          error={tokenError}
          label="Verification code"
          maxLength={AUTH_VALIDATION.tokenMaxLength}
          name="verificationCode"
          onChange={(event) => {
            setToken(event.target.value);
            setTokenError('');
          }}
          placeholder="Paste the code from your email"
          required
          spellCheck={false}
          value={token}
        />
        <Button loading={isVerifying} size="lg" type="submit">
          Verify account <span aria-hidden="true">→</span>
        </Button>
      </form>

      <div className={styles.divider}>
        <span>Need a fresh code?</span>
      </div>

      <form className={styles.resendForm} noValidate onSubmit={handleResend}>
        <TextField
          autoComplete="email"
          error={emailError}
          label="Account email"
          maxLength={AUTH_VALIDATION.emailMaxLength}
          name="email"
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError('');
          }}
          required
          type="email"
          value={email}
        />
        <Button loading={isResending} type="submit" variant="secondary">
          Resend code
        </Button>
      </form>

      <p className={styles.switchPrompt}>
        Already verified? <Link href={ROUTES.signIn}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
