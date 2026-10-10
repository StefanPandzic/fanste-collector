import { describe, expect, it } from 'vitest';

import { bulkAssignTag } from './tags';

import type { FansteSupabaseClient } from '@fanste/supabase';

const steelbookTagId = '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f';
const inceptionId = '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70';
const matrixId = '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f';

function createFakeClient(added: number) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return Promise.resolve({ data: added, error: null });
    },
  } as unknown as FansteSupabaseClient;
  return { client, calls };
}

describe('bulkAssignTag', () => {
  it('sends each well-formed item id once and returns the links added', async () => {
    const { client, calls } = createFakeClient(2);
    const added = await bulkAssignTag(
      client,
      [inceptionId, matrixId, inceptionId, 'optimistic-1'],
      steelbookTagId,
    );
    expect(added).toBe(2);
    expect(calls).toEqual([
      {
        fn: 'assign_tag_to_items',
        args: { p_tag_id: steelbookTagId, p_item_ids: [inceptionId, matrixId] },
      },
    ]);
  });
});
