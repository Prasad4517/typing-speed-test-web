import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  resendVerificationBodySchema,
  resetPasswordBodySchema,
  sessionParamsSchema,
  sessionsQuerySchema,
  signInBodySchema,
  signUpBodySchema,
  updateProfileBodySchema,
  verifyEmailBodySchema,
} from '../schemas/auth.schema.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../utils/validate.js';
import {
  createValidateCsrf,
  createValidateLogoutCsrf,
  validateCsrfBootstrapOrigin,
  validateStateChangingOrigin,
} from '../utils/request-origin.js';

function withBody(schema) {
  return async (request) => {
    request.body = validateBody(request, schema);
  };
}

function withParams(schema) {
  return async (request) => {
    request.params = validateParams(request, schema);
  };
}

function withQuery(schema) {
  return async (request) => {
    request.query = validateQuery(request, schema);
  };
}

export default async function authRoutes(app, { controllers, csrfService }) {
  const auth = controllers.auth;
  const requireAuth = (request) => auth.authenticate(request);
  const validateCsrf = createValidateCsrf(csrfService);
  const validateLogoutCsrf = createValidateLogoutCsrf(csrfService);
  const publicMutation = (schema, action) => [
    withBody(schema),
    validateStateChangingOrigin,
    validateCsrf,
    auth.rateLimit(action),
  ];

  app.get('/auth/csrf', {
    preHandler: [validateCsrfBootstrapOrigin],
    handler: auth.csrf,
  });

  app.post('/auth/signup', {
    preHandler: publicMutation(signUpBodySchema, 'signup'),
    handler: auth.signUp,
  });

  app.post('/auth/signin', {
    preHandler: publicMutation(signInBodySchema, 'signin'),
    handler: auth.signIn,
  });

  app.post('/auth/refresh', {
    preHandler: [
      validateStateChangingOrigin,
      validateCsrf,
      auth.rateLimit('refresh'),
    ],
    handler: auth.refresh,
  });

  app.post('/auth/logout', {
    preHandler: [validateStateChangingOrigin, validateLogoutCsrf],
    handler: auth.logout,
  });

  app.post('/auth/logout-all', {
    preHandler: [
      validateStateChangingOrigin,
      validateCsrf,
      requireAuth,
      auth.rateLimit('account'),
    ],
    handler: auth.logoutAll,
  });

  app.post('/auth/verify-email', {
    preHandler: publicMutation(verifyEmailBodySchema, 'verify'),
    handler: auth.verifyEmail,
  });

  app.post('/auth/resend-verification', {
    preHandler: publicMutation(resendVerificationBodySchema, 'resend'),
    handler: auth.resendVerification,
  });

  app.post('/auth/forgot-password', {
    preHandler: publicMutation(forgotPasswordBodySchema, 'forgot'),
    handler: auth.requestPasswordReset,
  });

  app.post('/auth/reset-password', {
    preHandler: publicMutation(resetPasswordBodySchema, 'reset'),
    handler: auth.resetPassword,
  });

  app.get('/account/me', {
    preHandler: [requireAuth],
    handler: auth.getMe,
  });

  app.patch('/account/me', {
    preHandler: [
      withBody(updateProfileBodySchema),
      validateStateChangingOrigin,
      validateCsrf,
      requireAuth,
      auth.rateLimit('account'),
    ],
    handler: auth.updateMe,
  });

  app.post('/account/change-password', {
    preHandler: [
      withBody(changePasswordBodySchema),
      validateStateChangingOrigin,
      validateCsrf,
      requireAuth,
      auth.rateLimit('account'),
    ],
    handler: auth.changePassword,
  });

  app.get('/account/sessions', {
    preHandler: [withQuery(sessionsQuerySchema), requireAuth],
    handler: auth.listSessions,
  });

  app.delete('/account/sessions/:sessionId', {
    preHandler: [
      withParams(sessionParamsSchema),
      validateStateChangingOrigin,
      validateCsrf,
      requireAuth,
      auth.rateLimit('account'),
    ],
    handler: auth.revokeSession,
  });

  app.get('/user/dashboard', {
    preHandler: [requireAuth],
    handler: auth.userDashboard,
  });

  app.get('/admin/dashboard', {
    preHandler: [requireAuth],
    handler: auth.adminDashboard,
  });
}
