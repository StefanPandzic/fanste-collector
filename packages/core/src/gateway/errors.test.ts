import { describe, expect, it } from 'vitest';

import { apiErrorSchema } from './errors';

describe('apiErrorSchema', () => {
  it('accepts a gateway error body with an optional provider', () => {
    const body = {
      error: { code: 'not_found', message: 'tmdb has no such item.', provider: 'tmdb' },
    };
    expect(apiErrorSchema.parse(body)).toEqual(body);
    expect(
      apiErrorSchema.safeParse({ error: { code: 'unauthorized', message: 'Sign in.' } }).success,
    ).toBe(true);
  });

  it('rejects unknown error codes', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'teapot', message: 'Short and stout.' } }).success,
    ).toBe(false);
  });
});
