import { describe, expect, it } from 'vitest';

import { bearerToken } from './bearer';

describe('bearerToken', () => {
  it('reads the token of a Bearer header', () => {
    expect(bearerToken('Bearer eyJhbGciOiJFUzI1NiJ9.payload.signature')).toBe(
      'eyJhbGciOiJFUzI1NiJ9.payload.signature',
    );
  });

  it('returns null without a header and undefined for a malformed one', () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeUndefined();
  });
});
