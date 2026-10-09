import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { providerFetch } from './provider-fetch';

const movieUrl = 'https://api.themoviedb.org/3/movie/603';

function stubFetch(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response)),
  );
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('providerFetch', () => {
  it('returns an OK response', async () => {
    stubFetch(Response.json({ id: 603, title: 'The Matrix' }));
    const response = await providerFetch('tmdb', movieUrl);
    expect(await response.json()).toEqual({ id: 603, title: 'The Matrix' });
  });

  it('throws not_found for 404 and provider_error for other failures', async () => {
    stubFetch(new Response(null, { status: 404 }));
    await expect(providerFetch('tmdb', movieUrl)).rejects.toMatchObject({
      code: 'not_found',
      provider: 'tmdb',
    });

    stubFetch(new Response(null, { status: 500 }));
    await expect(providerFetch('tmdb', movieUrl)).rejects.toMatchObject({
      code: 'provider_error',
      provider: 'tmdb',
    });
  });
});
