'use client';

import { ToastProvider } from '@/common-components';
import { AuthProvider, useAuth } from '@/features/auth';
import { AUTH_ROLE } from '@/features/auth/auth.constants';
import { RouteShell } from './route-shell';

function SessionAwareRouteShell({ children }) {
  const { hasRole, isLoading, signOut, user } = useAuth();
  const headerUser = user
    ? {
        id: user.id,
        name: user.fullName || user.name,
        email: user.email,
        isAdmin: hasRole(AUTH_ROLE.admin),
      }
    : null;

  return (
    <RouteShell isAuthLoading={isLoading} onSignOut={signOut} user={headerUser}>
      {children}
    </RouteShell>
  );
}

export function AppShell({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <SessionAwareRouteShell>{children}</SessionAwareRouteShell>
      </ToastProvider>
    </AuthProvider>
  );
}
