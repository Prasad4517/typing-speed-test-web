import { describe, expect, it } from 'vitest';

import { safeReturnPath } from '@/features/auth/safe-return-path';

describe('safeReturnPath', () => {
  it('keeps normal same-origin application paths', () => {
    expect(safeReturnPath('/progress?range=week#latest')).toBe(
      '/progress?range=week#latest',
    );
  });

  it.each([
    ['absolute URL', 'https://evil.example/'],
    ['protocol-relative URL', '//evil.example/'],
    ['backslash authority bypass', '/\\evil.example/'],
    ['encoded backslash bypass', '/%5cevil.example/'],
    ['double encoded backslash bypass', '/%255cevil.example/'],
    ['malformed encoding', '/%EA%A4%A'],
    ['authentication loop', '/sign-in'],
  ])('rejects %s', (_label, value) => {
    expect(safeReturnPath(value)).toBe('/dashboard');
  });
});
