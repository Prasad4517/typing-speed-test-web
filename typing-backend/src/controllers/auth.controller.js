import { isIP } from 'node:net';

import { AUTH } from '../constants/auth.js';
import { HEADERS } from '../constants/headers.js';
import {
  clearAuthCookies,
  setCsrfCookie,
  setRefreshCookie,
} from '../utils/auth-cookies.js';

function requestMetadata(request) {
  const userAgent = request.headers['user-agent'];
  const ipAddress =
    typeof request.ip === 'string' && isIP(request.ip) ? request.ip : null;
  return {
    requestId: String(request.id).slice(0, 80),
    ipAddress,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
  };
}

function publicAuthenticationResult(reply, result) {
  const { refreshToken, ...response } = result;
  setRefreshCookie(reply, refreshToken);
  setCsrfCookie(reply, result.csrfToken);
  return response;
}

export function createAuthController({ service }) {
  return {
    csrf: async (request, reply) => {
      const result = await service.createCsrfToken({
        refreshToken: request.cookies[AUTH.refreshCookieName],
      });
      setCsrfCookie(reply, result.csrfToken);
      return result;
    },

    rateLimit: (action) => async (request) =>
      service.checkRateLimit({
        action,
        metadata: requestMetadata(request),
        identifier: request.body?.email || request.auth?.userId || '',
      }),

    signUp: async (request, reply) => {
      const result = await service.signUp({
        ...request.body,
        metadata: requestMetadata(request),
      });
      reply.code(201);
      return result;
    },

    signIn: async (request, reply) =>
      publicAuthenticationResult(
        reply,
        await service.signIn({
          ...request.body,
          metadata: requestMetadata(request),
        }),
      ),

    refresh: async (request, reply) => {
      try {
        return publicAuthenticationResult(
          reply,
          await service.refresh({
            refreshToken: request.cookies[AUTH.refreshCookieName],
            csrf: request.csrf,
            metadata: requestMetadata(request),
          }),
        );
      } catch (error) {
        clearAuthCookies(reply);
        throw error;
      }
    },

    logout: async (request, reply) => {
      const result = await service.logout({
        refreshToken: request.cookies[AUTH.refreshCookieName],
        csrf: request.csrf,
        metadata: requestMetadata(request),
      });
      clearAuthCookies(reply);
      return result;
    },

    logoutAll: async (request, reply) => {
      const result = await service.logoutAll({
        auth: request.auth,
        csrf: request.csrf,
        metadata: requestMetadata(request),
      });
      clearAuthCookies(reply);
      return result;
    },

    verifyEmail: async (request) =>
      service.verifyEmail({
        ...request.body,
        metadata: requestMetadata(request),
      }),

    resendVerification: async (request) =>
      service.resendVerification({
        ...request.body,
        metadata: requestMetadata(request),
      }),

    requestPasswordReset: async (request) =>
      service.requestPasswordReset({
        ...request.body,
        metadata: requestMetadata(request),
      }),

    resetPassword: async (request, reply) => {
      const result = await service.resetPassword({
        ...request.body,
        metadata: requestMetadata(request),
      });
      clearAuthCookies(reply);
      return result;
    },

    authenticate: async (request) => {
      request.auth = await service.authenticateAccessToken(
        request.headers[HEADERS.authorization],
      );
    },

    getMe: async (request) => service.getCurrentUser(request.auth),

    updateMe: async (request) =>
      service.updateProfile({
        auth: request.auth,
        csrf: request.csrf,
        ...request.body,
      }),

    changePassword: async (request, reply) => {
      const result = await service.changePassword({
        auth: request.auth,
        csrf: request.csrf,
        metadata: requestMetadata(request),
        ...request.body,
      });
      clearAuthCookies(reply);
      return result;
    },

    listSessions: async (request) =>
      service.listSessions({ auth: request.auth, ...request.query }),

    revokeSession: async (request, reply) => {
      const result = await service.revokeSession({
        auth: request.auth,
        csrf: request.csrf,
        sessionId: request.params.sessionId,
        metadata: requestMetadata(request),
      });
      if (result.revokedCurrentSession) clearAuthCookies(reply);
      return result;
    },

    userDashboard: async (request) => service.userDashboard(request),
    adminDashboard: async (request) => service.adminDashboard(request),
  };
}
