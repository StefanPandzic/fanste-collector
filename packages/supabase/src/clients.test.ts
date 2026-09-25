import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserClient, createServerClient, createServiceClient } from './clients';

const url = 'https://abcdefghijklmnop.supabase.co';
const publicConfig = { url, publishableKey: 'sb_publishable_test' };
const serviceConfig = { url, secretKey: 'sb_secret_test' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createBrowserClient', () => {
  it('returns a Supabase client', () => {
    const client = createBrowserClient(publicConfig);
    expect(client).toHaveProperty('from');
    expect(client).toHaveProperty('auth');
  });
});

describe('createServerClient', () => {
  it('returns a Supabase client that uses the given cookies', () => {
    const client = createServerClient(publicConfig, { getAll: () => [], setAll: () => {} });
    expect(client).toHaveProperty('from');
    expect(client).toHaveProperty('auth');
  });
});

describe('createServiceClient', () => {
  it('returns a Supabase client on the server', () => {
    const client = createServiceClient(serviceConfig);
    expect(client).toHaveProperty('from');
    expect(client).toHaveProperty('auth');
  });

  it('refuses to run in a browser', () => {
    vi.stubGlobal('window', {});
    expect(() => createServiceClient(serviceConfig)).toThrow(/must never run in a browser/);
  });
});
