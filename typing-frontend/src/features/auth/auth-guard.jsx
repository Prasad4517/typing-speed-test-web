'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Spinner } from '@/common-components';
import { ROUTES } from '@/constants/routes';

import { useAuth } from './auth-provider';
import styles from './profile-page.module.scss';

export function AuthGuard({ children, role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasRole, status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const canAccess = isAuthenticated && (!role || hasRole(role));

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(
        `${ROUTES.signIn}?next=${encodeURIComponent(pathname || ROUTES.dashboard)}`,
      );
    }
    if (isAuthenticated && role && !hasRole(role)) {
      router.replace(ROUTES.dashboard);
    }
  }, [hasRole, isAuthenticated, pathname, role, router, status]);

  if (!canAccess) {
    return (
      <div className={styles.loading}>
        <Spinner label="Checking account access" />
        <p>
          {status === 'error'
            ? 'Account access could not be verified.'
            : 'Checking your secure session…'}
        </p>
      </div>
    );
  }

  return children;
}
