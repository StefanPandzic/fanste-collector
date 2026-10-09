import { describe, expect, it } from 'vitest';

import { findCopies, refKey } from './copies';

import type { FansteSupabaseClient } from '@fanste/supabase';

interface CopyRow {
  id: string;
  provider: string;
  external_id: string;
  format: string | null;
  ownership: string;
}

const rows: CopyRow[] = [
  {
    id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
    provider: 'tmdb',
    external_id: 'movie:603',
    format: '4K UHD Blu-ray',
    ownership: 'owned',
  },
  {
    id: '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f',
    provider: 'tmdb',
    external_id: 'movie:603',
    format: 'DVD',
    ownership: 'loaned_out',
  },
];

function createFakeClient() {
  const queries: { provider: string; ids: string[] }[] = [];
  const client = {
    from: () => {
      const query = { provider: '', ids: [] as string[] };
      const builder = {
        select: () => builder,
        eq: (_column: string, value: string) => {
          query.provider = value;
          return builder;
        },
        in: (_column: string, ids: string[]) => {
          query.ids = ids;
          return builder;
        },
        order: () => {
          queries.push(query);
          const data = rows.filter(
            (row) => row.provider === query.provider && query.ids.includes(row.external_id),
          );
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  } as unknown as FansteSupabaseClient;
  return { client, queries };
}

describe('refKey', () => {
  it('joins the provider and the external ID', () => {
    expect(refKey({ provider: 'tmdb', externalId: 'movie:603' })).toBe('tmdb:movie:603');
  });
});

describe('findCopies', () => {
  it('returns the copies of each ref and [] for refs without copies', async () => {
    const { client } = createFakeClient();
    expect(
      await findCopies(client, [
        { provider: 'tmdb', externalId: 'movie:603' },
        { provider: 'tmdb', externalId: 'tv:1396' },
      ]),
    ).toEqual({
      'tmdb:movie:603': [
        { id: rows[0]?.id, format: '4K UHD Blu-ray', ownership: 'owned' },
        { id: rows[1]?.id, format: 'DVD', ownership: 'loaned_out' },
      ],
      'tmdb:tv:1396': [],
    });
  });

  it('queries each provider in chunks of 100 external IDs', async () => {
    const { client, queries } = createFakeClient();
    const movies = Array.from({ length: 150 }, (_, index) => ({
      provider: 'tmdb' as const,
      externalId: `movie:${index + 1}`,
    }));
    await findCopies(client, [...movies, { provider: 'discogs', externalId: 'release:249504' }]);
    expect(queries.map((query) => [query.provider, query.ids.length])).toEqual([
      ['tmdb', 100],
      ['tmdb', 50],
      ['discogs', 1],
    ]);
  });
});
