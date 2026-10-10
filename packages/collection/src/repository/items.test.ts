import { describe, expect, it } from 'vitest';

import { bulkUpdateItems, toFilterJson } from './items';

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
