import { describe, expect, it, vi } from 'vitest';

import { backoffDelay, fetchWithRetry, parseRetryAfter } from './retry';

const retryOptions = { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 10_000 };

function tooManyRequests(retryAfter?: string): Response {
  return new Response(null, {
    status: 429,
    headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
  });
}

describe('parseRetryAfter', () => {
  it('reads seconds and HTTP dates as milliseconds', () => {
    expect(parseRetryAfter('120')).toBe(120_000);
    const now = Date.parse('Wed, 21 Oct 2026 07:28:00 GMT');
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:30 GMT', now)).toBe(30_000);
  });

  it('returns undefined for a missing or malformed header', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});

describe('backoffDelay', () => {
  it('doubles per attempt with jitter and stops at the maximum', () => {
    expect(backoffDelay(0, retryOptions, () => 0)).toBe(250);
    expect(backoffDelay(2, retryOptions, () => 0.5)).toBe(1500);
    expect(backoffDelay(10, retryOptions, () => 0)).toBe(10_000);
  });
});

describe('fetchWithRetry', () => {
  it('retries 429s with backoff until the request succeeds', async () => {
    const request = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(tooManyRequests())
      .mockResolvedValueOnce(tooManyRequests())
      .mockResolvedValueOnce(Response.json({ id: 603 }));
    const sleep = vi.fn(() => Promise.resolve());

    const response = await fetchWithRetry(request, { ...retryOptions, sleep, random: () => 0 });
    expect(response.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[250], [500]]);
  });

  it('waits as long as Retry-After asks', async () => {
    const request = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(tooManyRequests('2'))
      .mockResolvedValueOnce(Response.json({ id: 603 }));
    const sleep = vi.fn(() => Promise.resolve());

    await fetchWithRetry(request, { ...retryOptions, sleep });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('returns the last 429 after maxRetries or a too long Retry-After', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const alwaysLimited = vi.fn(() => Promise.resolve(tooManyRequests()));
    const response = await fetchWithRetry(alwaysLimited, { ...retryOptions, sleep });
    expect(response.status).toBe(429);
    expect(alwaysLimited).toHaveBeenCalledTimes(4);

    const longWait = vi.fn(() => Promise.resolve(tooManyRequests('60')));
    expect((await fetchWithRetry(longWait, { ...retryOptions, sleep })).status).toBe(429);
    expect(longWait).toHaveBeenCalledTimes(1);
  });
});
