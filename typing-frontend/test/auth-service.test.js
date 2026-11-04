import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/client-id', () => ({
  getClientId: () => '550e8400-e29b-41d4-a716-446655440000',
}));

import {
  __resetAuthClientForTests,
  getAccessToken,
  installAccessSession,
} from '@/services/auth-client';
import {
  changePassword,
  getAdminDashboard,
  getCurrentUser,
  getSessions,
  getUserDashboard,
  logout,
  logoutAll,
  resendVerification,
  resetPassword,
  revokeSession,
  signIn,
  signUp,
  updateCurrentUser,
  verifyEmail,
} from '@/services/auth.service';

function jsonResponse(body = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('authentication API client', () => {
  beforeEach(() => {
    __resetAuthClientForTests();
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/v1/auth/csrf') {
        return jsonResponse({ csrfToken: 'signed-csrf-token' });
      }
      return jsonResponse({ message: 'ok' });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetAuthClientForTests();
  });

  it.each([
    ['sign up', () => signUp({ email: 'ada@example.com' }), '/auth/signup'],
    [
      'verify email',
      () => verifyEmail({ token: 'verification-token' }),
      '/auth/verify-email',
    ],
    [
      'resend verification',
      () => resendVerification({ email: 'ada@example.com' }),
      '/auth/resend-verification',
    ],
    [
      'reset password',
      () =>
        resetPassword({ token: 'reset-token', newPassword: 'new-password' }),
      '/auth/reset-password',
    ],
  ])(
    'sends %s through the same-origin API with CSRF',
    async (_name, call, path) => {
      await call();

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/v1${path}`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'signed-csrf-token',
          }),
        }),
      );
    },
  );

  it('keeps the sign-in access token in memory and uses a Bearer header', async () => {
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/v1/auth/csrf') {
        return jsonResponse({ csrfToken: 'signed-csrf-token' });
      }
      if (url === '/api/v1/auth/signin') {
        return jsonResponse({
          accessToken: 'access-token',
          tokenType: 'Bearer',
          expiresIn: 300,
          user: { id: 'user-1', email: 'ada@example.com' },
        });
      }
      return jsonResponse({ user: { id: 'user-1', email: 'ada@example.com' } });
    });

    await signIn({ email: 'ada@example.com', password: 'secure-password' });
    const user = await getCurrentUser();

    expect(user.id).toBe('user-1');
    expect(getAccessToken()).toBe('access-token');
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/v1/account/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
    expect(window.localStorage.getItem('access-token')).toBeNull();
  });

  it('covers protected account, session, and role dashboard endpoints', async () => {
    installAccessSession({ accessToken: 'access-token', expiresIn: 300 });

    await updateCurrentUser({ fullName: 'Ada Byron' });
    await changePassword({ currentPassword: 'old', newPassword: 'new' });
    await getSessions();
    await revokeSession('session/id');
    await getUserDashboard();
    await getAdminDashboard();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/account/sessions/session%2Fid',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/user/dashboard',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/admin/dashboard',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it.each([
    ['logout', logout, '/api/v1/auth/logout'],
    ['logout all', logoutAll, '/api/v1/auth/logout-all'],
  ])(
    'clears auth before %s while sending the captured token',
    async (_name, call, url) => {
      installAccessSession({ accessToken: 'access-token', expiresIn: 300 });

      await call();

      expect(getAccessToken()).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        }),
      );
    },
  );
});
