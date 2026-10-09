import { describe, expect, it } from 'vitest';

import { createUserLimiter } from './user-limiter';

const userId = '7d1f3c2e-5b4a-4f0e-9a6d-2c8b1e0f3a91';

describe('createUserLimiter', () => {
  it('allows the limit per window, then asks the user to wait', () => {
    const limiter = createUserLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check(userId, 0)).toEqual({ allowed: true });
    expect(limiter.check(userId, 1000)).toEqual({ allowed: true });
    expect(limiter.check(userId, 2000)).toEqual({ allowed: false, retryAfterSeconds: 58 });
    expect(limiter.check('another-user', 2000)).toEqual({ allowed: true });
  });

  it('allows requests again once the window has passed', () => {
    const limiter = createUserLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check(userId, 0);
    expect(limiter.check(userId, 30_000).allowed).toBe(false);
    expect(limiter.check(userId, 60_001)).toEqual({ allowed: true });
  });
});
