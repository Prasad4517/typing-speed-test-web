'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  Card,
  Container,
  Spinner,
  TextField,
} from '@/common-components';
import { ROUTES } from '@/constants/routes';

import { AUTH_COPY, AUTH_VALIDATION } from './auth.constants';
import { useAuth } from './auth-provider';
import styles from './auth-page.module.scss';

export function ProfilePage() {
  const router = useRouter();
  const { isLoading, signOutEverywhere, status, updateProfile, user } =
    useAuth();
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOutEverywhere, setIsSigningOutEverywhere] = useState(false);

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
  }, [user?.fullName]);

  useEffect(() => {
    if (!isLoading && status !== 'authenticated') router.replace(ROUTES.signIn);
  }, [isLoading, router, status]);

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      await updateProfile({ fullName });
      setMessage('Your profile has been updated.');
    } catch (requestError) {
      setError(requestError?.message || 'We could not update your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOutEverywhere() {
    setError('');
    setIsSigningOutEverywhere(true);
    try {
      await signOutEverywhere();
      router.replace(ROUTES.home);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError?.message || 'We could not sign you out everywhere.',
      );
    } finally {
      setIsSigningOutEverywhere(false);
    }
  }

  if (isLoading || status !== 'authenticated' || !user) {
    return (
      <div className={styles.page}>
        <Spinner label="Loading profile" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Container size="sm">
        <Card className={styles.card}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>{AUTH_COPY.profile.eyebrow}</p>
            <h1>{AUTH_COPY.profile.title}</h1>
            <p>{AUTH_COPY.profile.description}</p>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}
          <form className={styles.form} onSubmit={saveProfile}>
            <TextField
              autoComplete="name"
              label={AUTH_COPY.fields.fullName}
              maxLength={AUTH_VALIDATION.fullNameMaxLength}
              onChange={(event) => setFullName(event.target.value)}
              required
              value={fullName}
            />
            <TextField
              disabled
              label={AUTH_COPY.fields.email}
              type="email"
              value={user.email}
            />
            <Button loading={isSaving} type="submit">
              {AUTH_COPY.profile.save}
            </Button>
          </form>
          <section className={styles.security}>
            <div>
              <h2>{AUTH_COPY.profile.securityTitle}</h2>
              <p>{AUTH_COPY.profile.securityDescription}</p>
            </div>
            <Button
              loading={isSigningOutEverywhere}
              onClick={handleSignOutEverywhere}
              variant="danger"
            >
              {AUTH_COPY.profile.logoutAll}
            </Button>
          </section>
        </Card>
      </Container>
    </div>
  );
}
