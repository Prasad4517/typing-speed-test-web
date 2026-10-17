import { LIMITS } from '../constants/limits.js';
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  resetPasswordBodySchema,
  signUpBodySchema,
  updateProfileBodySchema,
} from '../schemas/auth.schema.js';
import { validateBody } from '../utils/validate.js';
import { validateStateChangingOrigin } from '../utils/request-origin.js';

function withBody(schema) {
  return async (request) => {
    request.body = validateBody(request, schema);
  };
}

export default async function authRoutes(app, { controllers }) {
  const requireAuth = (request) => controllers.auth.authenticate(request);

  app.post('/auth/signup', {
    config: {
      rateLimit: {
        max: LIMITS.authSignUpRateLimit,
        timeWindow: LIMITS.rateLimitWindow,
      },
    },
    preHandler: [validateStateChangingOrigin, withBody(signUpBodySchema)],
    handler: controllers.auth.signUp,
  });

  app.post('/auth/login', {
    config: {
      rateLimit: {
        max: LIMITS.authLoginRateLimit,
        timeWindow: LIMITS.rateLimitWindow,
      },
    },
    preHandler: [validateStateChangingOrigin, withBody(loginBodySchema)],
    handler: controllers.auth.login,
  });

  app.post('/auth/refresh', {
    config: {
      rateLimit: {
        max: LIMITS.authRefreshRateLimit,
        timeWindow: LIMITS.rateLimitWindow,
      },
    },
    preHandler: [validateStateChangingOrigin],
    handler: controllers.auth.refresh,
  });

  app.post('/auth/logout', {
    preHandler: [validateStateChangingOrigin],
    handler: controllers.auth.logout,
  });

  app.post('/auth/logout-all', {
    preHandler: [validateStateChangingOrigin, requireAuth],
    handler: controllers.auth.logoutAll,
  });

  app.get('/me', {
    preHandler: [requireAuth],
    handler: controllers.auth.getMe,
  });

  app.patch('/me', {
    preHandler: [
      validateStateChangingOrigin,
      requireAuth,
      withBody(updateProfileBodySchema),
    ],
    handler: controllers.auth.updateMe,
  });

  app.post('/auth/forgot-password', {
    config: {
      rateLimit: {
        max: LIMITS.authPasswordResetRateLimit,
        timeWindow: LIMITS.rateLimitWindow,
      },
    },
    preHandler: [
      validateStateChangingOrigin,
      withBody(forgotPasswordBodySchema),
    ],
    handler: controllers.auth.requestPasswordReset,
  });

  app.post('/auth/reset-password', {
    config: {
      rateLimit: {
        max: LIMITS.authPasswordResetRateLimit,
        timeWindow: LIMITS.rateLimitWindow,
      },
    },
    preHandler: [
      validateStateChangingOrigin,
      withBody(resetPasswordBodySchema),
    ],
    handler: controllers.auth.resetPassword,
  });
}
