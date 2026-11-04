import { AUTH_VALIDATION } from './auth.constants';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (
    email.length > AUTH_VALIDATION.emailMaxLength ||
    !EMAIL_PATTERN.test(email)
  ) {
    return 'Enter a valid email address.';
  }
  return '';
}

export function validateFullName(value) {
  const name = value.trim();
  if (!name) return 'Enter your name.';
  if (name.length < 2) return 'Use at least 2 characters.';
  if (name.length > AUTH_VALIDATION.fullNameMaxLength) {
    return `Use ${AUTH_VALIDATION.fullNameMaxLength} characters or fewer.`;
  }
  if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(name)) {
    return 'Use letters, spaces, apostrophes, periods, or hyphens.';
  }
  return '';
}

export function validatePassword(value, { required = true } = {}) {
  if (!value) return required ? 'Enter your password.' : '';
  if (value.length < AUTH_VALIDATION.passwordMinLength) {
    return `Use at least ${AUTH_VALIDATION.passwordMinLength} characters.`;
  }
  if (value.trim().length < AUTH_VALIDATION.passwordMinLength) {
    return `Use at least ${AUTH_VALIDATION.passwordMinLength} non-space characters.`;
  }
  if (value.length > AUTH_VALIDATION.passwordMaxLength) {
    return `Use ${AUTH_VALIDATION.passwordMaxLength} characters or fewer.`;
  }
  return '';
}

export function validateConfirmation(password, confirmation) {
  if (!confirmation) return 'Confirm your new password.';
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}

export function validateSecurityToken(value, label = 'code') {
  const token = value.trim();
  if (!token) return `Enter the ${label} from your email.`;
  if (token.length < AUTH_VALIDATION.tokenMinLength) {
    return `That ${label} looks incomplete.`;
  }
  if (token.length > AUTH_VALIDATION.tokenMaxLength) {
    return `That ${label} is too long.`;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    return `That ${label} contains invalid characters.`;
  }
  return '';
}

export function getPasswordStrength(value) {
  if (!value) return { score: 0, label: 'Start typing' };
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/\p{Ll}/u.test(value) && /\p{Lu}/u.test(value)) score += 1;
  if (/\p{N}/u.test(value) || /[^\p{L}\p{N}\s]/u.test(value)) score += 1;
  const labels = ['Too short', 'Getting there', 'Good', 'Strong', 'Great'];
  return { score, label: labels[score] };
}

export function apiFieldErrors(error) {
  if (!Array.isArray(error?.details)) return {};
  return error.details.reduce((errors, detail) => {
    const field = detail?.field || detail?.path;
    if (field && detail?.message) errors[field] = detail.message;
    return errors;
  }, {});
}
