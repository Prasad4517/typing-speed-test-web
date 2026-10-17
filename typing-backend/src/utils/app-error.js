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
    details = [],
  ) {
    super(
      ERROR_CODES.RATE_LIMITED,
      message,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      details,
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
