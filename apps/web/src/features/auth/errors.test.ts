import { describe, expect, it } from 'vitest';

import { authErrorMessage, callbackErrorMessage, GENERIC_AUTH_ERROR } from './errors';

describe('authErrorMessage', () => {
  it('maps known Supabase error codes to messages', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Wrong email or password.');
  });

  it('uses a generic message for unknown or missing codes', () => {
    expect(authErrorMessage({ code: 'unexpected_failure' })).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage({})).toBe(GENERIC_AUTH_ERROR);
  });
});

describe('callbackErrorMessage', () => {
  it('maps known callback codes and ignores others', () => {
    expect(callbackErrorMessage('link_invalid')).toBe(
      'This link is invalid or has expired. Request a new one.',
    );
    expect(callbackErrorMessage('access_denied')).toBeUndefined();
    expect(callbackErrorMessage(undefined)).toBeUndefined();
  });
});
