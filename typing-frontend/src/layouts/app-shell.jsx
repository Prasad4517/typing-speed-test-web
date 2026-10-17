'use client';

import { ToastProvider } from '@/common-components';
import { AuthProvider, useAuth } from '@/features/auth';
import { RouteShell } from './route-shell';

function SessionAwareRouteShell({ children }) {
  const { isLoading, signOut, user } = useAuth();
  const headerUser = user
    ? { id: user.id, name: user.fullName, email: user.email }
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
