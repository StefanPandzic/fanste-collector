import { describe, expect, it } from 'vitest';

import { authCallbackUrl, findDeepLink, parseDeepLink } from './deep-link';

const appOrigin = 'http://localhost:3000';

describe('parseDeepLink', () => {
  it('parses fanste:// URLs', () => {
    const url = parseDeepLink('fanste://auth/callback?code=abc');
    expect(url?.host).toBe('auth');
    expect(url?.pathname).toBe('/callback');
    expect(url?.searchParams.get('code')).toBe('abc');
  });

  it('ignores other URLs and plain arguments', () => {
    expect(parseDeepLink('https://example.com/auth/callback')).toBeUndefined();
    expect(parseDeepLink('--allow-file-access-from-files')).toBeUndefined();
    expect(parseDeepLink('D:\\apps\\desktop')).toBeUndefined();
  });
});

describe('findDeepLink', () => {
  it('finds the deep link among command-line arguments', () => {
    const argv = [
      'C:\\Program Files\\Fanste Collector\\Fanste Collector.exe',
      '--disable-gpu',
      'fanste://auth/callback?code=abc',
    ];
    expect(findDeepLink(argv)?.href).toBe('fanste://auth/callback?code=abc');
  });

  it('returns undefined when there is none', () => {
    expect(findDeepLink(['electron.exe', '.'])).toBeUndefined();
  });
});

describe('authCallbackUrl', () => {
  it('maps the OAuth deep link to the web callback route with only the code', () => {
    const link = new URL('fanste://auth/callback?code=abc-123&next=//evil.com');
    expect(authCallbackUrl(link, appOrigin)?.href).toBe(
      'http://localhost:3000/auth/callback?code=abc-123',
    );
  });

  it('carries the provider error and drops malformed codes', () => {
    const denied = new URL('fanste://auth/callback?error=access_denied');
    expect(authCallbackUrl(denied, appOrigin)?.href).toBe(
      'http://localhost:3000/auth/callback?error=access_denied',
    );
    const malformed = new URL('fanste://auth/callback?code=abc%26next%3D%2F%2Fevil.com');
    expect(authCallbackUrl(malformed, appOrigin)?.href).toBe('http://localhost:3000/auth/callback');
  });

  it('returns undefined for other deep links', () => {
    expect(authCallbackUrl(new URL('fanste://scanner/open'), appOrigin)).toBeUndefined();
  });
});
