import { describe, expect, it } from 'vitest';

import { clientEnvSchema, parseEnv, serverEnvSchema } from './schema';

describe('env schemas', () => {
  it('accepts an empty environment while variables are optional', () => {
    expect(parseEnv(clientEnvSchema, {}, 'client')).toEqual({});
    expect(parseEnv(serverEnvSchema, {}, 'server')).toEqual({ NODE_ENV: 'development' });
  });

  it('treats empty strings as unset', () => {
    const env = parseEnv(clientEnvSchema, { NEXT_PUBLIC_SUPABASE_URL: '' }, 'client');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it('reports every invalid variable', () => {
    expect(() =>
      parseEnv(
        clientEnvSchema,
        { NEXT_PUBLIC_SUPABASE_URL: 'not-a-url', NEXT_PUBLIC_SUPABASE_ANON_KEY: 42 },
        'client',
      ),
    ).toThrow(
      /Invalid client environment.*NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/s,
    );
    expect(() => parseEnv(serverEnvSchema, { NODE_ENV: 'staging' }, 'server')).toThrow(/NODE_ENV/);
  });

  it('keeps server secrets out of the client schema', () => {
    const env = parseEnv(clientEnvSchema, { TMDB_API_READ_TOKEN: 'secret' }, 'client');
    expect(env).not.toHaveProperty('TMDB_API_READ_TOKEN');
  });
});
