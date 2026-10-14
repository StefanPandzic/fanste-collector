import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTwitchTokenSource } from './token';

const credentials = { clientId: 'fanste-client-id', clientSecret: 'fanste-client-secret' };
const twoMonthsSeconds = 60 * 24 * 60 * 60;

function stubTwitch() {
  let issued = 0;
  const fetchFn = vi.fn<typeof fetch>(() => {
    issued += 1;
    return Promise.resolve(
      Response.json({ access_token: `twitch-token-${issued}`, expires_in: twoMonthsSeconds }),
    );
  });
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createTwitchTokenSource', () => {
  it('caches the token and renews it once it is about to expire', async () => {
    const fetchFn = stubTwitch();
    let time = 0;
    const tokens = createTwitchTokenSource({ ...credentials, now: () => time });

    expect(await tokens.get()).toBe('twitch-token-1');
    expect(await tokens.get()).toBe('twitch-token-1');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://id.twitch.tv/oauth2/token');

    time = twoMonthsSeconds * 1000;
    expect(await tokens.get()).toBe('twitch-token-2');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('shares one Twitch request between concurrent calls', async () => {
    const fetchFn = stubTwitch();
    const tokens = createTwitchTokenSource(credentials);

    expect(await Promise.all([tokens.get(), tokens.get()])).toEqual([
      'twitch-token-1',
      'twitch-token-1',
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('drops only the current token on invalidate', async () => {
    stubTwitch();
    const tokens = createTwitchTokenSource(credentials);

    const first = await tokens.get();
    tokens.invalidate(first);
    const second = await tokens.get();
    expect(second).toBe('twitch-token-2');

    tokens.invalidate(first);
    expect(await tokens.get()).toBe(second);
  });
});
