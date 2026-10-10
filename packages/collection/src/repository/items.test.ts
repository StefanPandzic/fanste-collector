import { describe, expect, it } from 'vitest';

import { CollectionError } from '../errors';
import { bulkUpdateItems, restoreItem, toFilterJson } from './items';
import { toRestoreRow } from './mappers';

import type { CollectionItem } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

const inceptionId = '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70';
const matrixId = '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f';

function createFakeClient() {
  const updates: { row: Record<string, unknown>; ids: string[] }[] = [];
  const client = {
    from: () => {
      const update = { row: {} as Record<string, unknown>, ids: [] as string[] };
      const builder = {
        update: (row: Record<string, unknown>) => {
          update.row = row;
          return builder;
        },
        in: (_column: string, ids: string[]) => {
          update.ids = ids;
          return builder;
        },
        select: () => {
          updates.push(update);
          return Promise.resolve({ data: update.ids.map((id) => ({ id })), error: null });
        },
      };
      return builder;
    },
  } as unknown as FansteSupabaseClient;
  return { client, updates };
}

const steelbookTagId = '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f';
const deletedTagId = '8d2e1f3a-4b5c-4d6e-9f0a-1b2c3d4e5f60';

const inception: CollectionItem = {
  id: inceptionId,
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
  format: '4K UHD Blu-ray',
  details: { edition: 'Steelbook' },
  metadataOverrides: {},
  ownership: 'owned',
  quantity: 1,
  acquiredAt: null,
  purchasePrice: null,
  estimatedValue: null,
  currency: null,
  notes: null,
  source: 'search',
  createdAt: '2026-09-25T14:02:32.123456+00:00',
  updatedAt: '2026-09-25T14:02:32.123456+00:00',
  tagIds: [steelbookTagId, deletedTagId],
  metadata: null,
};

function createRestoreClient(existingTagIds: string[]) {
  const writes: { table: string; rows: unknown }[] = [];
  const client = {
    from: (table: string) => {
      const builder = {
        insert: (rows: unknown) => {
          writes.push({ table, rows });
          return Promise.resolve({ error: null });
        },
        upsert: (rows: unknown) => {
          writes.push({ table, rows });
          return Promise.resolve({ error: null });
        },
        select: () => builder,
        eq: () => builder,
        in: (_column: string, ids: string[]) =>
          Promise.resolve({
            data: ids.filter((id) => existingTagIds.includes(id)).map((id) => ({ id })),
            error: null,
          }),
        maybeSingle: () =>
          Promise.resolve({
            data: {
              id: inceptionId,
              user_id: inception.userId,
              category: 'movie',
              provider: 'tmdb',
              external_id: 'movie:27205',
              format: '4K UHD Blu-ray',
              details: { edition: 'Steelbook' },
              metadata_overrides: {},
              ownership: 'owned',
              quantity: 1,
              source: 'search',
              created_at: inception.createdAt,
              updated_at: inception.updatedAt,
              metadata_fetched_at: null,
              provider_title: null,
              collection_item_tags: existingTagIds.map((tagId) => ({ tag_id: tagId })),
            },
            error: null,
          }),
      };
      return builder;
    },
  } as unknown as FansteSupabaseClient;
  return { client, writes };
}

describe('toFilterJson', () => {
  it('keeps active filters and drops sort, paging and empty filters', () => {
    expect(
      toFilterJson({
        category: 'movie',
        ownership: [],
        formats: ['Blu-ray'],
        search: '  ',
        sort: 'title_asc',
        page: 3,
        details: { resolution: ['2160p'], hdr: [] },
      }),
    ).toEqual({ category: 'movie', formats: ['Blu-ray'], details: { resolution: ['2160p'] } });
  });

  it('is an empty object without filters', () => {
    expect(toFilterJson({})).toEqual({});
  });
});

describe('bulkUpdateItems', () => {
  it('applies the patch to the items and returns how many were updated', async () => {
    const { client, updates } = createFakeClient();
    expect(await bulkUpdateItems(client, [inceptionId, matrixId], { ownership: 'sold' })).toBe(2);
    expect(updates).toEqual([{ row: { ownership: 'sold' }, ids: [inceptionId, matrixId] }]);
  });

  it('updates in chunks of 100 items', async () => {
    const { client, updates } = createFakeClient();
    const ids = Array.from(
      { length: 150 },
      (_, index) => `3f6c1e2a-8b4d-4c5e-9f7a-${String(index).padStart(12, '0')}`,
    );
    expect(await bulkUpdateItems(client, ids, { ownership: 'loaned_out' })).toBe(150);
    expect(updates.map((update) => update.ids.length)).toEqual([100, 50]);
  });

  it('returns 0 without a request for an empty patch', async () => {
    const { client, updates } = createFakeClient();
    expect(await bulkUpdateItems(client, [inceptionId], {})).toBe(0);
    expect(updates).toEqual([]);
  });
});

describe('restoreItem', () => {
  it('inserts the copy again, re-links its existing tags and returns it', async () => {
    const { client, writes } = createRestoreClient([steelbookTagId]);
    const restored = await restoreItem(client, inception);
    expect(writes).toEqual([
      { table: 'collection_items', rows: toRestoreRow(inception) },
      { table: 'collection_item_tags', rows: [{ item_id: inceptionId, tag_id: steelbookTagId }] },
    ]);
    expect(restored.id).toBe(inceptionId);
    expect(restored.tagIds).toEqual([steelbookTagId]);
  });

  it('rejects a custom item', async () => {
    const { client, writes } = createRestoreClient([]);
    const error: unknown = await restoreItem(client, {
      ...inception,
      provider: 'custom',
      category: 'funko',
      externalId: null,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CollectionError);
    expect(error).toHaveProperty('code', 'invalid');
    expect(writes).toEqual([]);
  });
});
