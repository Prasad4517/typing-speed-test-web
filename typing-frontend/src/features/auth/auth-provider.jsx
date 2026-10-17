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

import { API } from '@/constants/api';
import {
  getCurrentUser,
  login,
  logout,
  logoutAll,
  refreshSession,
  signUp,
  updateCurrentUser,
} from '@/services/auth.service';
import { ApiError } from '@/services/http';

const AuthContext = createContext(null);

function isUnauthorized(error) {
  return (
    error instanceof ApiError && error.code === API.errorCodes.unauthorized
  );
}

/**
 * Stores profile data only. Access and refresh tokens remain inaccessible to
 * JavaScript in HttpOnly cookies managed by the backend.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: 'loading',
    user: null,
    error: null,
  });
  const bootstrapStarted = useRef(false);

  const loadSession = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));

    try {
      const user = await getCurrentUser();
      setState({ status: 'authenticated', user, error: null });
      return user;
    } catch (error) {
      if (!isUnauthorized(error)) {
        setState({ status: 'error', user: null, error });
        return null;
      }
    }

    try {
      const { user } = await refreshSession();
      setState({ status: 'authenticated', user, error: null });
      return user;
    } catch (error) {
      if (isUnauthorized(error)) {
        setState({ status: 'anonymous', user: null, error: null });
      } else {
        setState({ status: 'error', user: null, error });
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    void loadSession();
  }, [loadSession]);

  const authenticate = useCallback(async (operation) => {
    const { user } = await operation();
    setState({ status: 'authenticated', user, error: null });
    return user;
  }, []);

  const value = useMemo(
    () => ({
      user: state.user,
      status: state.status,
      error: state.error,
      isAuthenticated: state.status === 'authenticated',
      isLoading: state.status === 'loading',
      signIn: (payload) => authenticate(() => login(payload)),
      signUp: (payload) => authenticate(() => signUp(payload)),
      refresh: loadSession,
      updateProfile: async (payload) => {
        const user = await updateCurrentUser(payload);
        setState({ status: 'authenticated', user, error: null });
        return user;
      },
      signOut: async () => {
        await logout();
        setState({ status: 'anonymous', user: null, error: null });
      },
      signOutEverywhere: async () => {
        await logoutAll();
        setState({ status: 'anonymous', user: null, error: null });
      },
    }),
    [authenticate, loadSession, state.error, state.status, state.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
