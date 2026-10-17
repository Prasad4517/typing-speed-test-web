import { AUTH } from '../constants/auth.js';
import { clearAuthCookies, setAuthCookies } from '../utils/auth-cookies.js';

function requestMetadata(request) {
  const userAgent = request.headers['user-agent'];

  return {
    ipAddress: request.ip?.slice(0, 45) || null,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
  };
}

export function createAuthController({ service }) {
  return {
    signUp: async (request, reply) => {
      const result = await service.signUp({
        ...request.body,
        metadata: requestMetadata(request),
      });
      setAuthCookies(reply, result.tokens);
      reply.code(201);
      return { user: result.user };
    },

    login: async (request, reply) => {
      const result = await service.login({
        ...request.body,
        metadata: requestMetadata(request),
      });
      setAuthCookies(reply, result.tokens);
      return { user: result.user };
    },

    refresh: async (request, reply) => {
      try {
        const result = await service.refresh({
          refreshToken: request.cookies[AUTH.refreshCookieName],
          metadata: requestMetadata(request),
        });
        setAuthCookies(reply, result.tokens);
        return { user: result.user };
      } catch (error) {
        clearAuthCookies(reply);
        throw error;
      }
    },

    logout: async (request, reply) => {
      await service.logout({
        refreshToken: request.cookies[AUTH.refreshCookieName],
      });
      clearAuthCookies(reply);
      return { message: 'Signed out.' };
    },

    logoutAll: async (request, reply) => {
      await service.logoutAll({ userId: request.auth.userId });
      clearAuthCookies(reply);
      return { message: 'Signed out from all devices.' };
    },

    getMe: async (request) => service.getCurrentUser(request.auth),

    updateMe: async (request) =>
      service.updateProfile({ userId: request.auth.userId, ...request.body }),

    requestPasswordReset: async (request) =>
      service.requestPasswordReset(request.body),

    resetPassword: async (request) => service.resetPassword(request.body),

    authenticate: async (request) => {
      request.auth = await service.authenticateAccessToken(
        request.cookies[AUTH.accessCookieName],
      );
    },
  };
}
