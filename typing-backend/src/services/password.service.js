import argon2 from 'argon2';

import { AUTH } from '../constants/auth.js';
import { MESSAGES } from '../constants/messages.js';
import { ValidationError } from '../utils/app-error.js';

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'password1234',
  'qwertyuiop12',
  'letmeinplease',
  'correcthorsebatterystaple',
  'adminpassword',
  'welcome12345',
]);

const passwordOptions = Object.freeze({
  type: argon2.argon2id,
  ...AUTH.passwordHashing,
});

const dummyPasswordHash = argon2.hash(
  'not-a-valid-user-password-for-keystroke',
  passwordOptions,
);

export function createPasswordService(config) {
  return Object.freeze({
    validate(password) {
      if (
        typeof password !== 'string' ||
        password.length < config.passwordMinLength ||
        password.length > config.passwordMaxLength ||
        password.trim().length < config.passwordMinLength
      ) {
        throw new ValidationError(
          `Password must contain ${config.passwordMinLength}–${config.passwordMaxLength} characters.`,
        );
      }
      if (COMMON_PASSWORDS.has(password.toLowerCase().replace(/\s/g, ''))) {
        throw new ValidationError(MESSAGES.weakPassword);
      }
    },
    hash(password) {
      return argon2.hash(password, passwordOptions);
    },
    verify(hash, password) {
      return argon2.verify(hash, password);
    },
    async verifyDummy(password) {
      return argon2.verify(await dummyPasswordHash, password);
    },
    needsRehash(hash) {
      return argon2.needsRehash(hash, passwordOptions);
    },
  });
}
