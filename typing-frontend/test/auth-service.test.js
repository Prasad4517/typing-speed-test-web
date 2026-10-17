import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/client-id', () => ({
  getClientId: () => '550e8400-e29b-41d4-a716-446655440000',
}));

import {
  getCurrentUser,
  login,
  logout,
  logoutAll,
  refreshSession,
  requestPasswordReset,
  resetPassword,
  signUp,
  updateCurrentUser,
} from '@/services/auth.service';

const API_URL = 'http://localhost:4000/api';

function jsonResponse(body = {}) {
  return { ok: true, json: vi.fn().mockResolvedValue(body) };
}

describe('authentication API client', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API_URL;
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ user: { id: 'user-1' } }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [
      'sign up',
      () =>
        signUp({
          fullName: 'Ada Lovelace',
          email: 'ada@example.com',
          password: 'secure-password',
        }),
      '/auth/signup',
      'POST',
    ],
    [
      'login',
      () => login({ email: 'ada@example.com', password: 'secure-password' }),
      '/auth/login',
      'POST',
    ],
    ['refresh', () => refreshSession(), '/auth/refresh', 'POST'],
    ['logout', () => logout(), '/auth/logout', 'POST'],
    ['logout all', () => logoutAll(), '/auth/logout-all', 'POST'],
    ['current user', () => getCurrentUser(), '/me', 'GET'],
    [
      'update profile',
      () => updateCurrentUser({ fullName: 'Ada Byron' }),
      '/me',
      'PATCH',
    ],
    [
      'forgot password',
      () => requestPasswordReset({ email: 'ada@example.com' }),
      '/auth/forgot-password',
      'POST',
    ],
    [
      'reset password',
      () =>
        resetPassword({ token: 'reset-token', password: 'secure-password' }),
      '/auth/reset-password',
      'POST',
    ],
  ])(
    'calls the %s endpoint with browser credentials',
    async (_label, call, path, method) => {
      await call();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_URL}${path}`,
        expect.objectContaining({
          method,
          credentials: 'include',
          cache: 'no-store',
          headers: expect.objectContaining({
            Accept: 'application/json',
            'X-Client-Id': '550e8400-e29b-41d4-a716-446655440000',
          }),
        }),
      );
    },
  );
});
