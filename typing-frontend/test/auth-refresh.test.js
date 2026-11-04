import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/client-id', () => ({ getClientId: () => null }));

import {
  __resetAuthClientForTests,
  getAccessToken,
  getCsrfToken,
  installAccessSession,
} from '@/services/auth-client';
import {
  changePassword,
  getCurrentUser,
  logout,
  refreshSession,
  signIn,
} from '@/services/auth.service';

function jsonResponse(body = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('coordinated access-token refresh', () => {
  beforeEach(() => {
    __resetAuthClientForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetAuthClientForTests();
  });

  it('uses one refresh for concurrent 401 responses and retries each request once', async () => {
    installAccessSession({ accessToken: 'old-token', expiresIn: 300 });
    let refreshCalls = 0;
    global.fetch = vi.fn(async (url, options) => {
      if (url === '/api/v1/auth/csrf') {
        return jsonResponse({ csrfToken: 'signed-csrf-token' });
      }
      if (url === '/api/v1/auth/refresh') {
        refreshCalls += 1;
        return jsonResponse({ accessToken: 'new-token', expiresIn: 300 });
      }
      if (options.headers.Authorization === 'Bearer old-token') {
        return jsonResponse(
          { error: { code: 'UNAUTHORIZED', message: 'Expired' } },
          401,
        );
      }
      return jsonResponse({ user: { id: 'user-1' } });
    });

    const [first, second] = await Promise.all([
      getCurrentUser(),
      getCurrentUser(),
    ]);

    expect(first.id).toBe('user-1');
    expect(second.id).toBe('user-1');
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe('new-token');
  });

  it('does not restore a token when logout races an in-flight refresh', async () => {
    await getCsrfToken();
    let releaseRefresh;
    const refreshResponse = new Promise((resolve) => {
      releaseRefresh = resolve;
    });

    global.fetch = vi.fn(async (url) => {
      if (url === '/api/v1/auth/refresh') return refreshResponse;
      if (url === '/api/v1/auth/logout') return jsonResponse({ message: 'ok' });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const refreshing = refreshSession();
    await Promise.resolve();
    const signingOut = logout();
    releaseRefresh(
      jsonResponse({
        accessToken: 'stale-racing-token',
        csrfToken: 'rotated-session-csrf',
        expiresIn: 300,
      }),
    );
    await Promise.all([refreshing, signingOut]);

    expect(getAccessToken()).toBeNull();
  });

  it('installs the session-bound CSRF proof returned with an access token', async () => {
    installAccessSession({
      accessToken: 'access-token',
      csrfToken: 'session-bound-csrf',
      expiresIn: 300,
    });
    global.fetch = vi.fn(async (url, options) => {
      if (url === '/api/v1/auth/logout') {
        expect(options.headers['X-CSRF-Token']).toBe('session-bound-csrf');
        return jsonResponse({ message: 'ok' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await logout();

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('never starts a refresh after logout has begun', async () => {
    installAccessSession({
      accessToken: 'access-token',
      csrfToken: 'session-bound-csrf',
      expiresIn: 300,
    });
    let finishLogoutRequest;
    const logoutResponse = new Promise((resolve) => {
      finishLogoutRequest = resolve;
    });
    let refreshCalls = 0;
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/v1/auth/logout') return logoutResponse;
      if (url === '/api/v1/auth/refresh') {
        refreshCalls += 1;
        return jsonResponse({ accessToken: 'should-not-install' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const signingOut = logout();
    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/auth/logout',
        expect.any(Object),
      );
    });
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
    finishLogoutRequest(jsonResponse({ message: 'ok' }));
    await signingOut;

    expect(refreshCalls).toBe(0);
    expect(getAccessToken()).toBeNull();
  });

  it('does not refresh for a domain-specific 401 response', async () => {
    installAccessSession({
      accessToken: 'access-token',
      csrfToken: 'session-bound-csrf',
      expiresIn: 300,
    });
    let refreshCalls = 0;
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/v1/account/change-password') {
        return jsonResponse(
          {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid credentials.',
            },
          },
          401,
        );
      }
      if (url === '/api/v1/auth/refresh') {
        refreshCalls += 1;
        return jsonResponse({ accessToken: 'unwanted-token' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await expect(
      changePassword({ currentPassword: 'wrong', newPassword: 'new-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });

    expect(refreshCalls).toBe(0);
    expect(getAccessToken()).toBe('access-token');
  });

  it('serializes sign-in behind an in-flight refresh cookie rotation', async () => {
    let releaseRefresh;
    const refreshResponse = new Promise((resolve) => {
      releaseRefresh = resolve;
    });
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      if (url === '/api/v1/auth/csrf') {
        return jsonResponse({ csrfToken: 'account-a-csrf' });
      }
      if (url === '/api/v1/auth/refresh') return refreshResponse;
      if (url === '/api/v1/auth/signin') {
        return jsonResponse({
          accessToken: 'account-b-token',
          csrfToken: 'account-b-csrf',
          expiresIn: 300,
          user: { id: 'account-b' },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await getCsrfToken();

    const refreshing = refreshSession();
    await Promise.resolve();
    const signingIn = signIn({
      email: 'account-b@example.com',
      password: 'password-for-account-b',
    });
    expect(calls).not.toContain('/api/v1/auth/signin');

    releaseRefresh(
      jsonResponse({
        accessToken: 'account-a-refreshed-token',
        csrfToken: 'account-a-csrf',
        expiresIn: 300,
        user: { id: 'account-a' },
      }),
    );
    await Promise.all([refreshing, signingIn]);

    expect(calls.indexOf('/api/v1/auth/refresh')).toBeLessThan(
      calls.indexOf('/api/v1/auth/signin'),
    );
    expect(getAccessToken()).toBe('account-b-token');
  });
});
