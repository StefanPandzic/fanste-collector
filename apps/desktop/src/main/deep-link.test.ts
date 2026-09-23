import { describe, expect, it } from 'vitest';

import { findDeepLink, parseDeepLink } from './deep-link';

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
