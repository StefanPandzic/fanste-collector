import { describe, expect, it } from 'vitest';

import { requireSupabaseEnv } from './config';

const url = 'https://abcdefghijklmnop.supabase.co';

describe('requireSupabaseEnv', () => {
  it('returns the values when every variable is set', () => {
    expect(
      requireSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    });
  });

  it('names every missing or empty variable in one error', () => {
    expect(() =>
      requireSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
        SUPABASE_SECRET_KEY: undefined,
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY/);
  });
});
