import { ZodError } from 'zod';

import { config } from '../config/env.js';
import { ERROR_CODES } from '../constants/error-codes.js';
import { HTTP_STATUS } from '../constants/http-status.js';
import { AppError, ValidationError } from '../utils/app-error.js';

function errorEnvelope(code, message, details = []) {
  return { error: { code, message, details } };
}

function zodDetails(error) {
  return error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}

export default function registerErrorHandler(app) {
  app.setNotFoundHandler((request, reply) => {
    reply
      .status(HTTP_STATUS.NOT_FOUND)
      .send(
        errorEnvelope(
          ERROR_CODES.NOT_FOUND,
          `Route ${request.method} ${request.url} not found.`,
        ),
      );
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(errorEnvelope(error.code, error.message, error.details));
    }

    if (error instanceof ZodError) {
      const validationError = new ValidationError(
        'Request validation failed.',
        zodDetails(error),
      );
      return reply
        .status(validationError.statusCode)
        .send(
          errorEnvelope(
            validationError.code,
            validationError.message,
            validationError.details,
          ),
        );
    }

    if (error.code === 'FST_ERR_VALIDATION') {
      return reply
        .status(HTTP_STATUS.BAD_REQUEST)
        .send(
          errorEnvelope(
            ERROR_CODES.VALIDATION_ERROR,
            'Request validation failed.',
          ),
        );
    }

    request.log.error(error);
    const details = config.isProduction ? [] : [{ message: error.message }];

    return reply
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .send(
        errorEnvelope(
          ERROR_CODES.INTERNAL_ERROR,
          'An unexpected error occurred.',
          details,
        ),
      );
  });
}
