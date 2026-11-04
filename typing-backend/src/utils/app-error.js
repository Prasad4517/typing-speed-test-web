import { ERROR_CODES } from '../constants/error-codes.js';
import { HTTP_STATUS } from '../constants/http-status.js';

export class AppError extends Error {
  constructor(code, message, statusCode, details = []) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed.', details = []) {
    super(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      HTTP_STATUS.BAD_REQUEST,
      details,
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.', details = []) {
    super(ERROR_CODES.NOT_FOUND, message, HTTP_STATUS.NOT_FOUND, details);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'The request conflicts with the current resource state.',
    details = [],
  ) {
    super(ERROR_CODES.CONFLICT, message, HTTP_STATUS.CONFLICT, details);
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = 'Too many requests. Please try again later.',
    retryAfterSeconds,
  ) {
    super(
      ERROR_CODES.RATE_LIMITED,
      message,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      retryAfterSeconds ? [{ retryAfterSeconds }] : [],
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(message = 'A required service is temporarily unavailable.') {
    super(
      ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      message,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
    );
  }
}

export class SessionExpiredError extends AppError {
  constructor(message = 'The test session has expired.', details = []) {
    super(ERROR_CODES.SESSION_EXPIRED, message, HTTP_STATUS.GONE, details);
  }
}

export class SuspiciousResultError extends AppError {
  constructor(
    message = 'The submitted result could not be verified.',
    details = [],
  ) {
    super(
      ERROR_CODES.SUSPICIOUS_RESULT,
      message,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'The request is not authorized.', details = []) {
    super(ERROR_CODES.UNAUTHORIZED, message, HTTP_STATUS.UNAUTHORIZED, details);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Invalid credentials.') {
    super(ERROR_CODES.INVALID_CREDENTIALS, message, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class InvalidSessionError extends AppError {
  constructor(message = 'The session is invalid or expired.') {
    super(ERROR_CODES.INVALID_SESSION, message, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class RefreshReuseDetectedError extends AppError {
  constructor(message = 'Refresh-token reuse was detected.') {
    super(
      ERROR_CODES.REFRESH_REUSE_DETECTED,
      message,
      HTTP_STATUS.UNAUTHORIZED,
    );
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor(message = 'Email verification is required.') {
    super(ERROR_CODES.EMAIL_NOT_VERIFIED, message, HTTP_STATUS.FORBIDDEN);
  }
}

export class AccountLockedError extends AppError {
  constructor(message = 'The account is temporarily locked.') {
    super(ERROR_CODES.ACCOUNT_LOCKED, message, HTTP_STATUS.TOO_MANY_REQUESTS);
  }
}

export class AccountUnavailableError extends AppError {
  constructor(message = 'The account is unavailable.') {
    super(ERROR_CODES.ACCOUNT_UNAVAILABLE, message, HTTP_STATUS.FORBIDDEN);
  }
}

export class InvalidCsrfError extends AppError {
  constructor(message = 'The security proof is missing or invalid.') {
    super(ERROR_CODES.INVALID_CSRF, message, HTTP_STATUS.FORBIDDEN);
  }
}

export class InvalidVerificationTokenError extends AppError {
  constructor(message = 'The verification token is invalid or expired.') {
    super(
      ERROR_CODES.INVALID_VERIFICATION_TOKEN,
      message,
      HTTP_STATUS.UNAUTHORIZED,
    );
  }
}

export class InvalidPasswordResetTokenError extends AppError {
  constructor(message = 'The password reset token is invalid or expired.') {
    super(
      ERROR_CODES.INVALID_PASSWORD_RESET_TOKEN,
      message,
      HTTP_STATUS.UNAUTHORIZED,
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(ERROR_CODES.FORBIDDEN, message, HTTP_STATUS.FORBIDDEN);
  }
}
