import { describe, expect, it } from 'vitest';

import { routeAccess, safeNextPath, signInPathFor } from './routes';

describe('routeAccess', () => {
  it('classifies guest-only, public and protected paths', () => {
    expect(routeAccess('/sign-in')).toBe('guest-only');
    expect(routeAccess('/forgot-password')).toBe('guest-only');
    expect(routeAccess('/auth/callback')).toBe('public');
    expect(routeAccess('/reset-password')).toBe('public');
    expect(routeAccess('/api/tmdb/movie/603')).toBe('public');
    expect(routeAccess('/dashboard')).toBe('protected');
    expect(routeAccess('/collection/tmdb/603')).toBe('protected');
  });
});

describe('safeNextPath', () => {
  it('keeps same-origin paths with query and hash', () => {
    expect(safeNextPath('/collection?type=movie#top')).toBe('/collection?type=movie#top');
  });

  it('falls back for open redirects and non-paths', () => {
    expect(safeNextPath('//evil.com')).toBe('/dashboard');
    expect(safeNextPath('/\\evil.com')).toBe('/dashboard');
    expect(safeNextPath('https://evil.com/dashboard')).toBe('/dashboard');
    expect(safeNextPath('collection')).toBe('/dashboard');
    expect(safeNextPath(null, '/settings')).toBe('/settings');
  });
});

describe('signInPathFor', () => {
  it('adds the next path to the sign-in URL', () => {
    expect(signInPathFor('/collection?type=movie')).toBe(
      '/sign-in?next=%2Fcollection%3Ftype%3Dmovie',
    );
  });

  it('omits next for the default page and unsafe paths', () => {
    expect(signInPathFor('/dashboard')).toBe('/sign-in');
    expect(signInPathFor('//evil.com')).toBe('/sign-in');
  });
});
