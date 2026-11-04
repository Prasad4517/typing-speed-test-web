'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Avatar,
  Button,
  Card,
  Container,
  Modal,
  Spinner,
  TextField,
} from '@/common-components';
import { ROUTES } from '@/constants/routes';
import { getSessions, revokeSession } from '@/services/auth.service';

import { AUTH_COPY, AUTH_VALIDATION } from './auth.constants';
import {
  validateConfirmation,
  validateFullName,
  validatePassword,
} from './auth-validation';
import { useAuth } from './auth-provider';
import { PasswordField } from './password-field';
import styles from './profile-page.module.scss';

function sessionLabel(session) {
  return (
    session.label ||
    session.deviceLabel ||
    session.deviceName ||
    session.browser ||
    'Browser session'
  );
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function ProfilePage() {
  const router = useRouter();
  const {
    changePassword,
    clearSession,
    isLoading,
    signOutEverywhere,
    status,
    updateProfile,
    user,
  } = useAuth();
  const [fullName, setFullName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmation: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsStatus, setSessionsStatus] = useState('loading');
  const [sessionsError, setSessionsError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const displayName = user?.fullName || user?.name || 'Keystroke member';
  const roles = useMemo(() => {
    if (!user?.roles) return [];
    return user.roles.map((role) =>
      typeof role === 'string' ? role : role.name || role.code,
    );
  }, [user?.roles]);

  useEffect(() => {
    if (user) setFullName(user.fullName || user.name || '');
  }, [user]);

  useEffect(() => {
    if (!isLoading && status !== 'authenticated') {
      router.replace(
        `${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.profile)}`,
      );
    }
  }, [isLoading, router, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    setSessionsStatus('loading');
    getSessions()
      .then((items) => {
        if (!active) return;
        setSessions(Array.isArray(items) ? items : []);
        setSessionsStatus('ready');
      })
      .catch((error) => {
        if (!active) return;
        setSessionsError(
          error?.message || 'We could not load your active sessions.',
        );
        setSessionsStatus('error');
      });
    return () => {
      active = false;
    };
  }, [status]);

  async function saveProfile(event) {
    event.preventDefault();
    const validationError = validateFullName(fullName);
    setProfileError(validationError);
    if (validationError || isSaving) return;

    setProfileNotice('');
    setIsSaving(true);
    try {
      await updateProfile({ fullName: fullName.trim() });
      setProfileNotice('Profile saved — looking good.');
    } catch (requestError) {
      setProfileError(
        requestError?.message || 'We could not update your profile.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updatePassword(event) {
    const { name, value } = event.target;
    setPasswords((current) => ({ ...current, [name]: value }));
    setPasswordErrors((current) => ({ ...current, [name]: '' }));
    setPasswordError('');
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    if (isChangingPassword) return;
    const nextErrors = {
      currentPassword: passwords.currentPassword
        ? ''
        : 'Enter your current password.',
      newPassword: validatePassword(passwords.newPassword),
      confirmation: validateConfirmation(
        passwords.newPassword,
        passwords.confirmation,
      ),
    };
    setPasswordErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsChangingPassword(true);
    try {
      await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      router.replace(`${ROUTES.signIn}?message=password-changed`);
    } catch (requestError) {
      setPasswordError(
        requestError?.message || 'We could not change your password.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction || isConfirming) return;
    setIsConfirming(true);
    setSessionsError('');
    try {
      if (pendingAction.type === 'logout-all') {
        await signOutEverywhere();
        router.replace(`${ROUTES.signIn}?message=signed-out`);
        return;
      }

      await revokeSession(pendingAction.session.id);
      if (pendingAction.session.isCurrent || pendingAction.session.current) {
        clearSession();
        router.replace(`${ROUTES.signIn}?message=signed-out`);
        return;
      }
      setSessions((current) =>
        current.filter((session) => session.id !== pendingAction.session.id),
      );
      setPendingAction(null);
    } catch (requestError) {
      setSessionsError(
        requestError?.message || 'We could not revoke that session.',
      );
      setPendingAction(null);
    } finally {
      setIsConfirming(false);
    }
  }

  if (isLoading || status !== 'authenticated' || !user) {
    return (
      <div className={styles.loading}>
        <Spinner label="Securing your account" />
        <p>Restoring your private account data…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Container>
        <motion.header
          animate={{ opacity: 1, y: 0 }}
          className={styles.hero}
          initial={false}
        >
          <div className={styles.identity}>
            <Avatar name={displayName} size="lg" />
            <div>
              <p>Account cockpit</p>
              <h1>{displayName}</h1>
              <span>{user.email}</span>
            </div>
          </div>
          <div className={styles.accountMeta}>
            <span className={styles.verified}>
              <i />{' '}
              {user.emailVerified ? 'Email verified' : 'Verification pending'}
            </span>
            {roles.map((role) => (
              <span key={role}>{String(role).replace('ROLE_', '')}</span>
            ))}
          </div>
        </motion.header>

        <div className={styles.grid}>
          <Card className={styles.card}>
            <div className={styles.cardHeading}>
              <span>01</span>
              <div>
                <h2>Profile</h2>
                <p>Keep your public typing records recognizable.</p>
              </div>
            </div>
            {profileNotice ? (
              <Alert tone="success">{profileNotice}</Alert>
            ) : null}
            <form className={styles.form} noValidate onSubmit={saveProfile}>
              <TextField
                autoComplete="name"
                error={profileError}
                label={AUTH_COPY.fields.fullName}
                maxLength={AUTH_VALIDATION.fullNameMaxLength}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setProfileError('');
                }}
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
                Save profile
              </Button>
            </form>
          </Card>

          <Card className={styles.card}>
            <div className={styles.cardHeading}>
              <span>02</span>
              <div>
                <h2>Change password</h2>
                <p>All devices sign out after a successful change.</p>
              </div>
            </div>
            {passwordError ? (
              <Alert tone="danger">{passwordError}</Alert>
            ) : null}
            <form
              className={styles.form}
              noValidate
              onSubmit={handleChangePassword}
            >
              <PasswordField
                autoComplete="current-password"
                error={passwordErrors.currentPassword}
                label="Current password"
                maxLength={AUTH_VALIDATION.passwordMaxLength}
                name="currentPassword"
                onChange={updatePassword}
                required
                value={passwords.currentPassword}
              />
              <PasswordField
                autoComplete="new-password"
                error={passwordErrors.newPassword}
                label="New password"
                maxLength={AUTH_VALIDATION.passwordMaxLength}
                minLength={AUTH_VALIDATION.passwordMinLength}
                name="newPassword"
                onChange={updatePassword}
                required
                showStrength
                value={passwords.newPassword}
              />
              <PasswordField
                autoComplete="new-password"
                error={passwordErrors.confirmation}
                label="Confirm new password"
                maxLength={AUTH_VALIDATION.passwordMaxLength}
                minLength={AUTH_VALIDATION.passwordMinLength}
                name="confirmation"
                onChange={updatePassword}
                required
                value={passwords.confirmation}
              />
              <Button loading={isChangingPassword} type="submit">
                Update password
              </Button>
            </form>
          </Card>
        </div>

        <Card className={styles.sessionsCard}>
          <div className={styles.sessionsHeading}>
            <div className={styles.cardHeading}>
              <span>03</span>
              <div>
                <h2>Active sessions</h2>
                <p>Review every browser that can access your account.</p>
              </div>
            </div>
            <Button
              onClick={() => setPendingAction({ type: 'logout-all' })}
              variant="danger"
            >
              Log out all devices
            </Button>
          </div>

          {sessionsError ? <Alert tone="danger">{sessionsError}</Alert> : null}
          {sessionsStatus === 'loading' ? (
            <div className={styles.sessionLoading}>
              <Spinner label="Loading active sessions" />
            </div>
          ) : null}
          {sessionsStatus === 'ready' && sessions.length === 0 ? (
            <p className={styles.emptySessions}>
              No active sessions were returned for this account.
            </p>
          ) : null}
          {sessionsStatus === 'ready' && sessions.length ? (
            <div className={styles.sessionList}>
              {sessions.map((session) => (
                <article className={styles.session} key={session.id}>
                  <span aria-hidden="true" className={styles.deviceIcon}>
                    {session.isCurrent || session.current ? '●' : '⌁'}
                  </span>
                  <div>
                    <h3>
                      {sessionLabel(session)}
                      {session.isCurrent || session.current ? (
                        <span>Current</span>
                      ) : null}
                    </h3>
                    <p>
                      Started {formatDate(session.createdAt)} · Last active{' '}
                      {formatDate(
                        session.lastActivityAt ||
                          session.lastUsedAt ||
                          session.updatedAt,
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      setPendingAction({ type: 'revoke', session })
                    }
                    size="sm"
                    variant="secondary"
                  >
                    Revoke
                  </Button>
                </article>
              ))}
            </div>
          ) : null}
        </Card>
      </Container>

      <Modal
        onClose={() => !isConfirming && setPendingAction(null)}
        open={Boolean(pendingAction)}
        title={
          pendingAction?.type === 'logout-all'
            ? 'Log out every device?'
            : 'Revoke this session?'
        }
      >
        <div className={styles.confirmation}>
          <p>
            {pendingAction?.type === 'logout-all'
              ? 'Every active browser will need to sign in again, including this one.'
              : 'This browser will lose account access. If it is your current session, you will be signed out too.'}
          </p>
          <div>
            <Button
              disabled={isConfirming}
              onClick={() => setPendingAction(null)}
              variant="secondary"
            >
              Keep session
            </Button>
            <Button
              loading={isConfirming}
              onClick={confirmPendingAction}
              variant="danger"
            >
              {pendingAction?.type === 'logout-all'
                ? 'Log out everywhere'
                : 'Revoke session'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
