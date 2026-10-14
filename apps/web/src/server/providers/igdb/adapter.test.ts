import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizedItemSchema, parseVideoGameExtra } from '@fanste/core';

import gameFixture from './__fixtures__/game-119133.json';
import platformsFixture from './__fixtures__/platforms.json';
import searchFixture from './__fixtures__/search-elden-ring.json';
import { createIgdbAdapter } from './adapter';

const credentials = { clientId: 'fanste-client-id', clientSecret: 'fanste-client-secret' };
const tokenUrl = 'https://id.twitch.tv/oauth2/token';

function toUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function authorizationOf(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization;
}

function stubIgdb(respond: (url: string, init: RequestInit | undefined) => Response) {
  let issued = 0;
  const fetchFn = vi.fn<typeof fetch>((input, init) => {
    const url = toUrl(input);
    if (url === tokenUrl) {
      issued += 1;
      return Promise.resolve(
        Response.json({ access_token: `twitch-token-${issued}`, expires_in: 5_000_000 }),
      );
    }
    return Promise.resolve(respond(url, init));
  });
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
}

function igdbCalls(fetchFn: ReturnType<typeof stubIgdb>) {
  return fetchFn.mock.calls.filter(([input]) => toUrl(input) !== tokenUrl);
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

describe('createIgdbAdapter', () => {
  it('finds Elden Ring with its cover, platforms and the X-Count total', async () => {
    const fetchFn = stubIgdb(() =>
      Response.json(searchFixture.body, { headers: { 'X-Count': String(searchFixture.count) } }),
    );
    const response = await createIgdbAdapter(credentials).search('Elden Ring', {
      category: 'video_game',
      page: 1,
    });

    expect(response.results[0]).toMatchObject({
      provider: 'igdb',
      externalId: '119133',
      title: 'Elden Ring',
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
      detail: 'Series X|S · PS4 · Switch 2 · PC · PS5 · +1',
    });
    expect(response).toMatchObject({ page: 1, totalPages: 1, totalResults: 6 });

    const [input, init] = igdbCalls(fetchFn)[0] ?? [];
    expect(input && toUrl(input)).toBe('https://api.igdb.com/v4/games');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toHaveProperty('Client-ID', 'fanste-client-id');
    expect(init?.headers).toHaveProperty('Authorization', 'Bearer twitch-token-1');
  });

  it('sends the platform filter in the search query', async () => {
    const fetchFn = stubIgdb(() =>
      Response.json(searchFixture.body, { headers: { 'X-Count': String(searchFixture.count) } }),
    );
    await createIgdbAdapter(credentials).search('Elden Ring', {
      category: 'video_game',
      page: 1,
      platform: 167,
    });

    const [, init] = igdbCalls(fetchFn)[0] ?? [];
    expect(init?.body).toContain('platforms = (167)');
  });

  it('returns a valid NormalizedItem for a game', async () => {
    stubIgdb(() => Response.json(gameFixture));
    const item = normalizedItemSchema.parse(
      await createIgdbAdapter(credentials).getById('119133', 'video_game'),
    );
    expect(item).toMatchObject({ externalId: '119133', title: 'Elden Ring' });
    expect(parseVideoGameExtra(item.extra)?.gameType).toBe('Main Game');
  });

  it('throws not_found when IGDB has no such game', async () => {
    stubIgdb(() => Response.json([]));
    await expect(
      createIgdbAdapter(credentials).getById('999999999', 'video_game'),
    ).rejects.toMatchObject({ code: 'not_found', provider: 'igdb' });
  });

  it('renews the token and retries once after a 401', async () => {
    const fetchFn = stubIgdb((_url, init) =>
      authorizationOf(init) === 'Bearer twitch-token-1'
        ? new Response(null, { status: 401 })
        : Response.json(gameFixture),
    );

    const item = await createIgdbAdapter(credentials).getById('119133', 'video_game');
    expect(item.title).toBe('Elden Ring');
    expect(igdbCalls(fetchFn).map(([, init]) => authorizationOf(init))).toEqual([
      'Bearer twitch-token-1',
      'Bearer twitch-token-2',
    ]);
  });

  it('lists the platforms and caches the list', async () => {
    const fetchFn = stubIgdb(() => Response.json(platformsFixture));
    const adapter = createIgdbAdapter(credentials);

    const platforms = await adapter.platforms();
    expect(platforms).toContainEqual({ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' });
    expect(platforms).toHaveLength(platformsFixture.length);
    expect(toUrl(igdbCalls(fetchFn)[0]?.[0] ?? '')).toBe('https://api.igdb.com/v4/platforms');

    const calls = fetchFn.mock.calls.length;
    expect(await adapter.platforms()).toBe(platforms);
    expect(fetchFn).toHaveBeenCalledTimes(calls);
  });
});
