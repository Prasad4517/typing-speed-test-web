'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { Alert, Card, Container, Spinner } from '@/common-components';
import { ROUTES } from '@/constants/routes';
import { getAdminDashboard, getUserDashboard } from '@/services/auth.service';

import { AUTH_ROLE } from './auth.constants';
import { AuthGuard } from './auth-guard';
import { useAuth } from './auth-provider';
import styles from './dashboard-page.module.scss';

const QUICK_ACTIONS = Object.freeze([
  {
    index: '01',
    title: 'Start a speed run',
    description:
      'Jump into a fresh timed test and chase your next personal best.',
    href: ROUTES.home,
    accent: 'lime',
  },
  {
    index: '02',
    title: 'Read your progress',
    description:
      'See the pace, accuracy, and consistency behind your practice.',
    href: ROUTES.progress,
    accent: 'violet',
  },
  {
    index: '03',
    title: 'Tune your account',
    description: 'Update your profile, password, and active browser sessions.',
    href: ROUTES.profile,
    accent: 'coral',
  },
]);

function dashboardMessage(data, fallback) {
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.title === 'string') return data.title;
  return fallback;
}

export function DashboardPage({ admin = false }) {
  const { user } = useAuth();
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: '',
  });

  useEffect(() => {
    let active = true;
    const load = admin ? getAdminDashboard : getUserDashboard;
    load()
      .then((data) => {
        if (active) setState({ status: 'ready', data, error: '' });
      })
      .catch((error) => {
        if (active) {
          setState({
            status: 'error',
            data: null,
            error: error?.message || 'This dashboard is unavailable right now.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [admin]);

  const name = user?.fullName || user?.name || 'speedster';
  const firstName = name.trim().split(/\s+/)[0];

  return (
    <AuthGuard role={admin ? AUTH_ROLE.admin : undefined}>
      <div className={styles.page}>
        <Container>
          <motion.header
            animate={{ opacity: 1, y: 0 }}
            className={styles.hero}
            initial={false}
          >
            <div>
              <p className={styles.eyebrow}>
                {admin ? 'Admin access verified' : 'Your private dashboard'}
              </p>
              <h1>
                Hey, {firstName}.<br />
                <em>
                  {admin ? 'Command center unlocked.' : 'Ready to level up?'}
                </em>
              </h1>
            </div>
            <div className={styles.sessionCard}>
              <span className={styles.pulse} />
              <div>
                <strong>Session protected</strong>
                <p>In-memory access · secure refresh · live role checks</p>
              </div>
            </div>
          </motion.header>

          {state.status === 'loading' ? (
            <div className={styles.loading}>
              <Spinner label="Loading private dashboard" />
            </div>
          ) : null}
          {state.status === 'error' ? (
            <Alert tone="danger">{state.error}</Alert>
          ) : null}
          {state.status === 'ready' ? (
            <Alert tone="success">
              {dashboardMessage(
                state.data,
                admin
                  ? 'Administrative authorization confirmed.'
                  : 'Your authenticated workspace is ready.',
              )}
            </Alert>
          ) : null}

          {admin ? (
            <section className={styles.adminPanel}>
              <Card>
                <span>RBAC</span>
                <h2>Backend-enforced access</h2>
                <p>
                  This view renders only after the server confirms an active
                  admin role. Hidden navigation is never treated as security.
                </p>
              </Card>
              <Card>
                <span>LIVE</span>
                <h2>Security-aware session</h2>
                <p>
                  Revocation, password changes, and role changes invalidate
                  stale access through the same central client.
                </p>
              </Card>
            </section>
          ) : (
            <section className={styles.actions} aria-label="Quick actions">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  className={styles[action.accent]}
                  href={action.href}
                  key={action.href}
                >
                  <span>{action.index}</span>
                  <h2>{action.title}</h2>
                  <p>{action.description}</p>
                  <b aria-hidden="true">↗</b>
                </Link>
              ))}
            </section>
          )}
        </Container>
      </div>
    </AuthGuard>
  );
}
