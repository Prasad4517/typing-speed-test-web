import { ValidationError } from './app-error.js';

function validate(schema, value, source) {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ValidationError(
      `Invalid request ${source}.`,
      result.error.issues,
    );
  }

  return result.data;
}

export function validateParams(request, schema) {
  return validate(schema, request.params, 'parameters');
}

export function validateQuery(request, schema) {
  return validate(schema, request.query, 'query');
}

export function validateBody(request, schema) {
  return validate(schema, request.body, 'body');
}

export function validateHeaders(request, schema) {
  return validate(schema, request.headers, 'headers');
}
