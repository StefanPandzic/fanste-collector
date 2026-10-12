import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizedItemSchema, parseMusicExtra } from '@fanste/core';

import { DISCOGS_RATE } from '../../limits';
import masterFixture from './__fixtures__/master-24047.json';
import releaseFixture from './__fixtures__/release-2607424.json';
import searchFixture from './__fixtures__/search-abbey-road-vinyl.json';
import {
  codeParam,
  createDiscogsAdapter,
  DISCOGS_DEFAULT_CONTACT_URL,
  discogsPauseMs,
  discogsUserAgent,
} from './adapter';

const credentials = { consumerKey: 'fanste-consumer-key', consumerSecret: 'fanste-secret' };
const coverThumb =
  'https://i.discogs.com/uKBZ4UD1ZLYLd8H4ZuEy2ticElp1MpwRfS9gw74wXZk/rs:fit/g:sm/q:40/h:150/w:150/czM6Ly9kaXNjb2dz/R-14186441.jpeg';

const fixtures: Record<string, unknown> = {
  '/database/search': searchFixture,
  '/releases/2607424': releaseFixture,
  '/masters/24047': masterFixture,
};

function toUrl(input: RequestInfo | URL): URL {
  return new URL(input instanceof Request ? input.url : input);
}

function stubDiscogs(respond: (url: URL) => unknown = (url) => fixtures[url.pathname]) {
  const fetchFn = vi.fn<typeof fetch>((input) => {
    const body = respond(toUrl(input));
    return Promise.resolve(
      body === undefined ? new Response(null, { status: 404 }) : Response.json(body),
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

describe('createDiscogsAdapter', () => {
  it('finds vinyl releases of Abbey Road with a cover thumbnail', async () => {
    const [first, ...rest] = searchFixture.results;
    const fetchFn = stubDiscogs(() => ({
      ...searchFixture,
      results: [{ ...first, thumb: coverThumb }, ...rest],
    }));
    const adapter = createDiscogsAdapter({ ...credentials, contactUrl: 'https://fanste.app' });

    const response = await adapter.search('Abbey Road', {
      category: 'music',
      page: 1,
      year: 1969,
      format: 'Vinyl',
    });
    expect(response.results[0]).toMatchObject({
      provider: 'discogs',
      externalId: 'release:14186441',
      title: 'Abbey Road',
      subtitle: 'The Beatles',
      thumbnailUrl: coverThumb,
    });
    expect(response.results.every((result) => result.detail?.startsWith('Vinyl'))).toBe(true);
    expect(response).toMatchObject({ page: 1, totalPages: 500, totalResults: 18174 });

    const [input, init] = fetchFn.mock.calls[0] ?? [];
    const url = input ? toUrl(input) : undefined;
    expect(url?.pathname).toBe('/database/search');
    expect(url?.searchParams.get('q')).toBe('Abbey Road');
    expect(url?.searchParams.get('type')).toBe('release');
    expect(url?.searchParams.get('format')).toBe('Vinyl');
    expect(url?.searchParams.get('year')).toBe('1969');
    expect(url?.searchParams.get('per_page')).toBe('20');
    expect(init?.headers).toHaveProperty(
      'Authorization',
      'Discogs key=fanste-consumer-key, secret=fanste-secret',
    );
    expect(init?.headers).toHaveProperty('User-Agent', 'FansteCollector/1.0 +https://fanste.app');
  });

  it('looks a pressing up by catalog number and country without a query', async () => {
    const fetchFn = stubDiscogs(() => searchFixture);
    await createDiscogsAdapter(credentials).search('', {
      category: 'music',
      page: 1,
      country: 'UK',
      code: 'PCS 7088',
    });

    const input = fetchFn.mock.calls[0]?.[0];
    const params = input ? toUrl(input).searchParams : undefined;
    expect(params?.has('q')).toBe(false);
    expect(params?.get('country')).toBe('UK');
    expect(params?.get('catno')).toBe('PCS 7088');
  });

  it('looks an all-digit code up as a catalog number when no barcode matches', async () => {
    const empty = { pagination: { page: 1, pages: 0, items: 0 }, results: [] };
    const fetchFn = stubDiscogs((url) => (url.searchParams.has('barcode') ? empty : searchFixture));
    const response = await createDiscogsAdapter(credentials).search('', {
      category: 'music',
      page: 1,
      code: '12345678',
    });

    const [first, second] = fetchFn.mock.calls.map(([input]) => toUrl(input).searchParams);
    expect(first?.get('barcode')).toBe('12345678');
    expect(second?.get('catno')).toBe('12345678');
    expect(response.results.length).toBeGreaterThan(0);
  });

  it('returns a valid NormalizedItem for a release and a master', async () => {
    stubDiscogs();
    const adapter = createDiscogsAdapter(credentials);

    const release = normalizedItemSchema.parse(await adapter.getById('release:2607424', 'music'));
    expect(release).toMatchObject({ externalId: 'release:2607424', title: 'Abbey Road' });
    expect(parseMusicExtra(release.extra)).toMatchObject({ catalogNumber: 'PCS 7088' });

    const master = normalizedItemSchema.parse(await adapter.getById('master:24047', 'music'));
    expect(master).toMatchObject({ externalId: 'master:24047', title: 'Abbey Road' });
    expect(parseMusicExtra(master.extra)).toMatchObject({ discogsType: 'master' });
  });

  it('rejects bad external IDs and categories other than music', async () => {
    const fetchFn = stubDiscogs();
    const adapter = createDiscogsAdapter(credentials);

    await expect(adapter.getById('2607424', 'music')).rejects.toMatchObject({
      code: 'bad_request',
    });
    await expect(
      adapter.search('Abbey Road', { category: 'movie', page: 1 }),
    ).rejects.toMatchObject({ code: 'unsupported_category' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('codeParam', () => {
  it('sends digits as a barcode and anything else as a catalog number', () => {
    expect(codeParam('5 099745 042210')).toEqual({ barcode: '5099745042210' });
    expect(codeParam('EPC 450290 1')).toEqual({ catno: 'EPC 450290 1' });
  });
});

describe('discogsPauseMs', () => {
  it('pauses only when the remaining quota is down to the reserve', () => {
    const rateHeaders = (remaining: string) =>
      new Response(null, {
        headers: { 'X-Discogs-Ratelimit': '60', 'X-Discogs-Ratelimit-Remaining': remaining },
      });
    expect(discogsPauseMs(new Response(null))).toBeUndefined();
    expect(discogsPauseMs(rateHeaders('25'))).toBeUndefined();
    expect(discogsPauseMs(rateHeaders('1'))).toBe(3000);
  });

  it('pauses after a 429', () => {
    expect(discogsPauseMs(new Response(null, { status: 429 }))).toBe(DISCOGS_RATE.pauseOn429Ms);
  });
});

describe('discogsUserAgent', () => {
  it('names the app and a contact URL', () => {
    expect(discogsUserAgent()).toBe(`FansteCollector/1.0 +${DISCOGS_DEFAULT_CONTACT_URL}`);
    expect(discogsUserAgent('https://fanste.app')).toBe('FansteCollector/1.0 +https://fanste.app');
  });
});
