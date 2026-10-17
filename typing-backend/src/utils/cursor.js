import { Buffer } from 'node:buffer';

export function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed?.id || !parsed?.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}
