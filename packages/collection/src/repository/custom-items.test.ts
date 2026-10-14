import { describe, expect, it } from 'vitest';

import { addCustomItem, updateCustomItemData } from './custom-items';

import type { FansteSupabaseClient } from '@fanste/supabase';

const itemId = 'b2f1c6c0-3e8a-4f7e-9d7a-0c1f2e3d4a5b';
const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';
const spiderMan = { title: 'Spider-Man', identifier: '#123', subtitle: 'Marvel' };

const storedRow = {
  id: itemId,
  user_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'custom',
  provider: 'custom',
  external_id: null,
  custom_collection_id: funkoId,
  custom_data: spiderMan,
  format: 'Physical',
  details: { condition: 'Mint' },
  metadata_overrides: {},
  ownership: 'owned',
  quantity: 1,
  acquired_at: null,
  purchase_price: null,
  estimated_value: null,
  currency: null,
  notes: null,
  source: 'manual',
  created_at: '2026-10-14T12:00:00+00:00',
  updated_at: '2026-10-14T12:00:00+00:00',
};

function createFakeClient() {
  const inserts: { table: string; row: unknown }[] = [];
  const rpcs: { fn: string; args: unknown }[] = [];
  const client = {
    from: (table: string) => {
      const builder = {
        insert: (row: unknown) => {
          inserts.push({ table, row });
          return builder;
        },
        select: () => builder,
        eq: () => builder,
        single: () => Promise.resolve({ data: storedRow, error: null }),
        maybeSingle: () =>
          Promise.resolve({ data: { ...storedRow, collection_item_tags: [] }, error: null }),
      };
      return builder;
    },
    rpc: (fn: string, args: unknown) => {
      rpcs.push({ fn, args });
      return Promise.resolve({ data: [{ id: itemId }], error: null });
    },
  } as unknown as FansteSupabaseClient;
  return { client, inserts, rpcs };
}

describe('addCustomItem', () => {
  it('inserts a custom item with its own data and returns it', async () => {
    const { client, inserts, rpcs } = createFakeClient();
    const item = await addCustomItem(client, {
      category: 'custom',
      customCollectionId: funkoId,
      customData: spiderMan,
      format: 'Physical',
      details: { condition: 'Mint' },
    });
    expect(inserts).toEqual([
      {
        table: 'collection_items',
        row: {
          category: 'custom',
          provider: 'custom',
          external_id: null,
          custom_collection_id: funkoId,
          custom_data: spiderMan,
          details: { condition: 'Mint' },
          source: 'manual',
          format: 'Physical',
        },
      },
    ]);
    expect(rpcs).toEqual([]);
    expect(item.customCollectionId).toBe(funkoId);
    expect(item.metadata?.subtitle).toBe('#123 · Marvel');
  });
});

describe('updateCustomItemData', () => {
  it('merges the present fields with the RPC and returns the stored item', async () => {
    const { client, rpcs } = createFakeClient();
    const item = await updateCustomItemData(client, itemId, {
      title: 'Spider-Man',
      subtitle: null,
    });
    expect(rpcs).toEqual([
      {
        fn: 'merge_item_custom_data',
        args: { p_id: itemId, p_patch: { title: 'Spider-Man', subtitle: null } },
      },
    ]);
    expect(item.id).toBe(itemId);
  });
});
