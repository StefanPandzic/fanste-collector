import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { GatewayError } from '../errors';
import { createGatewayRoute } from './handler';
import { createUserLimiter } from '../rate-limit/user-limiter';

const userId = '7d1f3c2e-5b4a-4f0e-9a6d-2c8b1e0f3a91';
const request = new NextRequest('http://localhost:3000/api/search?category=movie&q=matrix');

function signedIn(limit = 60) {
  return createGatewayRoute({
    authenticate: () => Promise.resolve(userId),
    userLimiter: createUserLimiter({ limit, windowMs: 60_000 }),
  });
}

describe('createGatewayRoute', () => {
  it('passes the signed-in user to the handler', async () => {
    const handler = vi.fn(() => Promise.resolve(Response.json({ ok: true })));
    const response = await signedIn()('search', handler)(request, {});
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(request, { userId, context: {} });
  });

  it('answers 401 without a session and 429 over the user limit', async () => {
    const handler = vi.fn(() => Promise.resolve(Response.json({ ok: true })));
    const anonymous = createGatewayRoute({
      authenticate: () => Promise.resolve(null),
      userLimiter: createUserLimiter({ limit: 60, windowMs: 60_000 }),
    })('search', handler);
    const unauthorized = await anonymous(request, {});
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toHaveProperty('error.code', 'unauthorized');

    const route = signedIn(1)('search', handler);
    await route(request, {});
    const limited = await route(request, {});
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('turns handler errors into the error shape', async () => {
    const route = signedIn()('items', () =>
      Promise.reject(new GatewayError('not_found', 'tmdb has no such item.', { provider: 'tmdb' })),
    );
    const response = await route(request, {});
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'tmdb has no such item.', provider: 'tmdb' },
    });
  });
});
