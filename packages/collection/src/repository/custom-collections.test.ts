import { describe, expect, it } from 'vitest';

import {
  createCustomCollection,
  deleteCustomCollection,
  listCustomCollections,
  reorderCustomCollections,
  updateCustomCollection,
} from './custom-collections';

import type { FansteSupabaseClient } from '@fanste/supabase';

const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';
const legoId = '8e7d6c5b-4a39-4281-9706-f5e4d3c2b1a0';

const funkoRow = {
  id: funkoId,
  user_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  name: 'Funko Pops',
  description: null,
  icon: 'box',
  sort_order: 0,
  created_at: '2026-10-14T12:00:00+00:00',
  updated_at: '2026-10-14T12:00:00+00:00',
};

const funko = {
  id: funkoId,
  name: 'Funko Pops',
  description: null,
  icon: 'box',
  sortOrder: 0,
  createdAt: '2026-10-14T12:00:00+00:00',
  updatedAt: '2026-10-14T12:00:00+00:00',
};

function createFakeClient(rows: unknown[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const result = { data: rows, error: null };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    single: () => Promise.resolve({ data: rows[0], error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
  };
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  const client = {
    from: () => builder,
    rpc: (fn: string, args: unknown) => {
      calls.push({ method: 'rpc', args: [fn, args] });
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as FansteSupabaseClient;
  return { client, calls };
}

describe('listCustomCollections', () => {
  it('returns the collections in their order', async () => {
    const { client, calls } = createFakeClient([funkoRow]);
    expect(await listCustomCollections(client)).toEqual([funko]);
    expect(calls).toContainEqual({ method: 'order', args: ['sort_order'] });
  });
});

describe('createCustomCollection', () => {
  it('inserts the trimmed name with the default icon', async () => {
    const { client, calls } = createFakeClient([{ ...funkoRow, icon: 'shapes' }]);
    const created = await createCustomCollection(client, { name: '  Funko Pops ' });
    expect(calls).toContainEqual({
      method: 'insert',
      args: [{ name: 'Funko Pops', description: null, icon: 'shapes' }],
    });
    expect(created).toEqual({ ...funko, icon: 'shapes' });
  });
});

describe('updateCustomCollection', () => {
  it('sends only the changed fields', async () => {
    const { client, calls } = createFakeClient([{ ...funkoRow, name: 'Pops' }]);
    const updated = await updateCustomCollection(client, funkoId, { name: 'Pops' });
    expect(calls).toContainEqual({ method: 'update', args: [{ name: 'Pops' }] });
    expect(updated.name).toBe('Pops');
  });
});

describe('deleteCustomCollection', () => {
  it('fails with not_found when no collection was deleted', async () => {
    const { client } = createFakeClient([]);
    const error: unknown = await deleteCustomCollection(client, funkoId).catch(
      (caught: unknown) => caught,
    );
    expect(error).toHaveProperty('code', 'not_found');
  });
});

describe('reorderCustomCollections', () => {
  it('sends each well-formed id once', async () => {
    const { client, calls } = createFakeClient([]);
    await reorderCustomCollections(client, [legoId, 'optimistic-1', funkoId, legoId]);
    expect(calls).toEqual([
      { method: 'rpc', args: ['reorder_custom_collections', { p_ids: [legoId, funkoId] }] },
    ]);
  });
});
