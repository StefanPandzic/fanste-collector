import { describe, expect, it } from 'vitest';

import { canOpenExternally, isAppUrl, isPermissionAllowed } from './url-policy';

const appOrigin = 'http://localhost:3000';

describe('isAppUrl', () => {
  it('accepts URLs on the app origin', () => {
    expect(isAppUrl('http://localhost:3000/', appOrigin)).toBe(true);
    expect(isAppUrl('http://localhost:3000/collection?page=2#top', appOrigin)).toBe(true);
  });

  it('rejects other origins', () => {
    expect(isAppUrl('http://localhost:3001/', appOrigin)).toBe(false);
    expect(isAppUrl('https://localhost:3000/', appOrigin)).toBe(false);
    expect(isAppUrl('http://localhost.evil.com:3000/', appOrigin)).toBe(false);
    expect(isAppUrl('https://www.themoviedb.org/', appOrigin)).toBe(false);
  });

  it('rejects non-URLs and opaque origins', () => {
    expect(isAppUrl('', appOrigin)).toBe(false);
    expect(isAppUrl('about:blank', appOrigin)).toBe(false);
    expect(isAppUrl('file:///C:/Windows/', appOrigin)).toBe(false);
    expect(isAppUrl('data:text/html,<h1>hi</h1>', appOrigin)).toBe(false);
  });
});

describe('canOpenExternally', () => {
  it('allows web and mail links', () => {
    expect(canOpenExternally('https://www.themoviedb.org/movie/603')).toBe(true);
    expect(canOpenExternally('http://example.com')).toBe(true);
    expect(canOpenExternally('mailto:support@example.com')).toBe(true);
  });

  it('blocks everything that could run or open local things', () => {
    expect(canOpenExternally('file:///C:/Windows/System32/calc.exe')).toBe(false);
    expect(canOpenExternally('ms-settings:privacy')).toBe(false);
    expect(canOpenExternally('javascript:alert(1)')).toBe(false);
    expect(canOpenExternally('fanste://auth/callback')).toBe(false);
    expect(canOpenExternally('not a url')).toBe(false);
  });
});

describe('isPermissionAllowed', () => {
  it('allows listed permissions for the app origin only', () => {
    expect(
      isPermissionAllowed('clipboard-sanitized-write', 'http://localhost:3000/', appOrigin),
    ).toBe(true);
    expect(isPermissionAllowed('clipboard-sanitized-write', 'https://evil.com/', appOrigin)).toBe(
      false,
    );
  });

  it('denies unlisted permissions', () => {
    expect(isPermissionAllowed('media', 'http://localhost:3000/', appOrigin)).toBe(false);
    expect(isPermissionAllowed('geolocation', 'http://localhost:3000/', appOrigin)).toBe(false);
  });
});
