import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@fanste/api-client';

import { loadExportItems } from './export';

import type { ExportProgress } from './export';
import type { BatchResponse, ItemRef, NormalizedItem } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

const userId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const inceptionId = '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70';
const abbeyRoadId = '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f';

const inceptionRow = {
  id: inceptionId,
  user_id: userId,
  category: 'movie',
  provider: 'tmdb',
  external_id: 'movie:27205',
  format: '4K UHD Blu-ray',
  ownership: 'owned',
  quantity: 1,
  source: 'search',
  created_at: '2026-09-25T14:02:32.123456+00:00',
  updated_at: '2026-09-25T14:02:32.123456+00:00',
  metadata_fetched_at: null,
  provider_title: null,
  collection_item_tags: [],
};

const abbeyRoadRow = {
  ...inceptionRow,
  id: abbeyRoadId,
  category: 'music',
  provider: 'discogs',
  external_id: 'release:2607424',
  format: 'Vinyl',
};

const inceptionMetadata: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
};

/** A client whose `in('id', ...)` returns the rows with those IDs. */
function createIdsClient(rows: { id: string }[]) {
  return {
    from: () => ({
      select: () => ({
        in: (_column: string, ids: string[]) =>
          Promise.resolve({ data: rows.filter((row) => ids.includes(row.id)), error: null }),
      }),
    }),
  } as unknown as FansteSupabaseClient;
}

/** A client whose `collection_items_filtered` returns the rows of the filter's category. */
function createFilterClient(rowsByCategory: Record<string, { id: string }[]>) {
  return {
    rpc: (_name: string, args: { p_filter: { category?: string } }) => {
      const rows = rowsByCategory[args.p_filter.category ?? ''] ?? [];
      const builder = {
        select: () => builder,
        order: () => builder,
        range: () => Promise.resolve({ data: rows, count: rows.length, error: null }),
      };
      return builder;
    },
  } as unknown as FansteSupabaseClient;
}

const noBatch = (): Promise<BatchResponse> => Promise.resolve({ items: [], missing: [] });
const noSleep = () => Promise.resolve();

const abbeyRoadMetadata: NormalizedItem = {
  provider: 'discogs',
  externalId: 'release:2607424',
  category: 'music',
  title: 'Abbey Road',
};

describe('loadExportItems', () => {
  it('loads the items of each filter and reports the progress', async () => {
    const progress: ExportProgress[] = [];
    const { items } = await loadExportItems(
      createFilterClient({ movie: [inceptionRow], music: [abbeyRoadRow] }),
      { filters: [{ category: 'movie' }, { category: 'music' }] },
      { getItemsBatch: noBatch, onProgress: (value) => progress.push(value), sleep: noSleep },
    );
    expect(items.map((item) => item.id)).toEqual([inceptionId, abbeyRoadId]);
    expect(progress).toContainEqual({ phase: 'items', loaded: 2, total: 2 });
  });

  it('loads the items by ID and asks again for the metadata the gateway deferred', async () => {
    const requested: ItemRef[][] = [];
    const responses: BatchResponse[] = [
      {
        items: [inceptionMetadata],
        missing: [{ provider: 'discogs', externalId: 'release:2607424', reason: 'retry_later' }],
      },
      { items: [abbeyRoadMetadata], missing: [] },
    ];
    const { items, missingMetadata } = await loadExportItems(
      createIdsClient([inceptionRow, abbeyRoadRow]),
      { ids: [inceptionId, abbeyRoadId] },
      {
        getItemsBatch: (refs) => {
          requested.push([...refs]);
          return Promise.resolve(responses[requested.length - 1] ?? { items: [], missing: [] });
        },
        sleep: noSleep,
      },
    );
    expect(requested).toEqual([
      [
        { provider: 'tmdb', externalId: 'movie:27205' },
        { provider: 'discogs', externalId: 'release:2607424' },
      ],
      [{ provider: 'discogs', externalId: 'release:2607424' }],
    ]);
    expect(items.find((item) => item.id === inceptionId)?.metadata).toEqual(inceptionMetadata);
    expect(items.find((item) => item.id === abbeyRoadId)?.metadata).toEqual(abbeyRoadMetadata);
    expect(missingMetadata).toBe(0);
  });

  it('waits out a rate_limited answer, then retries', async () => {
    const waits: number[] = [];
    let calls = 0;
    const { items } = await loadExportItems(
      createIdsClient([inceptionRow]),
      { ids: [inceptionId] },
      {
        getItemsBatch: () => {
          calls += 1;
          return calls === 1
            ? Promise.reject(new ApiClientError(429, 'rate_limited', 'Slow down', undefined, 5))
            : Promise.resolve({ items: [inceptionMetadata], missing: [] });
        },
        sleep: (ms) => {
          waits.push(ms);
          return Promise.resolve();
        },
        requestGapMs: 0,
      },
    );
    expect(waits).toContain(5000);
    expect(items[0]?.metadata).toEqual(inceptionMetadata);
  });

  it('exports the items without metadata when the gateway fails, and counts them', async () => {
    const { items, missingMetadata } = await loadExportItems(
      createIdsClient([inceptionRow]),
      { ids: [inceptionId] },
      {
        getItemsBatch: () => Promise.reject(new Error('Service unavailable')),
        sleep: noSleep,
      },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.metadata).toBeNull();
    expect(missingMetadata).toBe(1);
  });
});
