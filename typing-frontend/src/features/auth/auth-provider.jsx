'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  bootstrapSession,
  changePassword as changePasswordRequest,
  clearAuthState,
  logout,
  logoutAll,
  signIn as signInRequest,
  signUp as signUpRequest,
  subscribeAuthSession,
  updateCurrentUser,
} from '@/services/auth.service';

const AuthContext = createContext(null);

const INITIAL_STATE = Object.freeze({
  status: 'initializing',
  user: null,
  error: null,
});

function isUnauthenticatedError(error) {
  return error?.status === 401 || error?.code === 'UNAUTHORIZED';
}

function userRoleNames(user) {
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];
  return roles
    .map((role) => (typeof role === 'string' ? role : role?.name || role?.code))
    .filter(Boolean);
}

/**
 * Owns safe user metadata only. Access tokens stay in module memory while the
 * refresh credential remains an inaccessible HttpOnly cookie.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);
  const bootstrapStarted = useRef(false);

  const loadSession = useCallback(async () => {
    setState((current) => ({
      ...current,
      status:
        current.status === 'authenticated' ? 'authenticated' : 'initializing',
      error: null,
    }));

    try {
      const { user } = await bootstrapSession();
      setState({ status: 'authenticated', user, error: null });
      return user;
    } catch (error) {
      if (isUnauthenticatedError(error)) {
        setState({ status: 'unauthenticated', user: null, error: null });
      } else {
        setState({ status: 'error', user: null, error });
      }
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAuthSession((event) => {
      if (event.type === 'authenticated' && event.user) {
        setState({ status: 'authenticated', user: event.user, error: null });
      }
      if (event.type === 'logout' || event.type === 'session-expired') {
        setState({ status: 'unauthenticated', user: null, error: null });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    void loadSession();
  }, [loadSession]);

  const clearSession = useCallback(({ broadcast = true } = {}) => {
    clearAuthState({ broadcast });
    setState({ status: 'unauthenticated', user: null, error: null });
  }, []);

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      authenticationStatus: state.status,
      error: state.error,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'initializing',
      signIn: async (payload) => {
        const response = await signInRequest(payload);
        const user = response?.user;
        if (!user)
          throw new Error('The server returned an invalid user session.');
        setState({ status: 'authenticated', user, error: null });
        return user;
      },
      signUp: (payload) => signUpRequest(payload),
      refreshSession: loadSession,
      refresh: loadSession,
      clearSession,
      hasRole: (role) => userRoleNames(state.user).includes(role),
      updateProfile: async (payload) => {
        const user = await updateCurrentUser(payload);
        setState({ status: 'authenticated', user, error: null });
        return user;
      },
      changePassword: async (payload) => {
        const result = await changePasswordRequest(payload);
        clearSession();
        return result;
      },
      signOut: async () => {
        try {
          return await logout();
        } finally {
          setState({ status: 'unauthenticated', user: null, error: null });
        }
      },
      signOutEverywhere: async () => {
        try {
          return await logoutAll();
        } finally {
          setState({ status: 'unauthenticated', user: null, error: null });
        }
      },
    }),
    [clearSession, loadSession, state.error, state.status, state.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
