import { describe, expect, it } from 'vitest';

import { oauthRedirectUrl } from './oauth';

const origin = 'http://localhost:3000';

describe('oauthRedirectUrl', () => {
  it('returns the web callback route with the next page in the browser', () => {
    expect(oauthRedirectUrl({ origin, next: '/collection', isDesktop: false })).toBe(
      'http://localhost:3000/auth/callback?next=%2Fcollection',
    );
  });

  it('returns the deep link in the desktop app', () => {
    expect(oauthRedirectUrl({ origin, next: '/collection', isDesktop: true })).toBe(
      'fanste://auth/callback',
    );
  });
});
