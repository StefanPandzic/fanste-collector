// Integration tests of the collection repository and Realtime sync against the dev Supabase Cloud
// project (FC-14). Run with `pnpm test:rls`.
//
// Each run creates a throwaway user, signed in on two clients ("two devices"), and deletes it
// afterwards, which removes all its rows. The email uses the RLS suite's `rls-test-` prefix, so a
// crashed run's user is removed by that suite's leftover cleanup.
import { randomInt, randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { toMetadataCacheRow } from '@fanste/core';
import { createServiceClient, requireSupabaseEnv } from '@fanste/supabase';

import { CollectionError } from './errors';
import { subscribeToCollectionChanges } from './realtime/subscribe';
import {
  addItem,
  bulkDelete,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from './repository/items';
import { getStats } from './repository/stats';
import { assignTag, createTag, deleteTag, listTags, unassignTag } from './repository/tags';

import type { CollectionChange } from './realtime/events';
import type { AddItemDeps } from './repository/items';
import type { NormalizedItem } from '@fanste/core';
import type { Database, FansteSupabaseClient } from '@fanste/supabase';

const env = requireSupabaseEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
});

const admin = createServiceClient({
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  secretKey: env.SUPABASE_SECRET_KEY,
});

function createPublicClient(): FansteSupabaseClient {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

/** A TMDB movie far above the real IDs, so test rows never clash with cached titles. */
function testMovie(title: string): NormalizedItem {
  return {
    provider: 'tmdb',
    externalId: `movie:${randomInt(10 ** 12, 2 ** 47)}`,
    category: 'movie',
    title,
    releaseYear: 2010,
    thumbnailUrl: 'https://image.tmdb.org/t/p/w185/test.jpg',
  };
}

/** Stands in for the gateway: writes the metadata cache like `api.getItem` would. */
const cachedMovies = new Map<string, NormalizedItem>();
const deps: AddItemDeps = {
  async getMetadata(ref) {
    const item = cachedMovies.get(ref.externalId);
    if (!item) throw new Error(`No test movie ${ref.externalId}.`);
    const { error } = await admin.from('metadata_cache').upsert(toMetadataCacheRow(item));
    if (error) throw error;
    return item;
  },
};

function movieInput(movie: NormalizedItem, format: string) {
  return {
    category: 'movie' as const,
    provider: 'tmdb' as const,
    externalId: movie.externalId,
    format,
    source: 'search' as const,
  };
}

describe('collection repository (dev Supabase project)', () => {
  const inception = testMovie('FC14 Inception');
  const matrix = testMovie('FC14 The Matrix');
  let userId: string;
  let deviceA: FansteSupabaseClient;
  let deviceB: FansteSupabaseClient;

  beforeAll(async () => {
    for (const movie of [inception, matrix]) cachedMovies.set(movie.externalId, movie);

    const email = `rls-test-${randomUUID()}@example.com`;
    const password = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;

    [deviceA, deviceB] = [createPublicClient(), createPublicClient()];
    for (const client of [deviceA, deviceB]) {
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    }
  });

  afterAll(async () => {
    await Promise.all([deviceA, deviceB].map((client) => client?.removeAllChannels()));
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.warn(`Could not delete test user ${userId}: ${error.message}`);
    }
    await admin
      .from('metadata_cache')
      .delete()
      .eq('provider', 'tmdb')
      .in('external_id', [...cachedMovies.keys()]);
  });

  it('adds an item with its metadata and refuses the same copy twice', async () => {
    const item = await addItem(deviceA, movieInput(inception, '4K UHD Blu-ray'), deps);
    expect(item).toMatchObject({
      userId,
      externalId: inception.externalId,
      format: '4K UHD Blu-ray',
      ownership: 'owned',
      source: 'search',
      metadata: { title: 'FC14 Inception' },
    });

    await expect(
      addItem(deviceA, movieInput(inception, '4k uhd blu-ray '), deps),
    ).rejects.toMatchObject({ code: 'duplicate' });
    // Another format is another copy.
    await addItem(deviceA, movieInput(inception, 'DVD'), deps);
  });

  it('lists, searches and reads items with their cached metadata', async () => {
    await addItem(deviceA, { ...movieInput(matrix, 'Blu-ray'), ownership: 'wishlist' }, deps);

    const all = await listItems(deviceA, { category: 'movie' });
    expect(all.total).toBe(3);
    expect(all.items[0]?.metadata?.title).toBe('FC14 The Matrix'); // newest first
    expect(all.items[0]?.metadata?.thumbnailUrl).toBe(matrix.thumbnailUrl);

    const search = await listItems(deviceA, { search: 'incep', sort: 'title_asc' });
    expect(search.items.map((item) => item.format)).toEqual(
      expect.arrayContaining(['4K UHD Blu-ray', 'DVD']),
    );
    expect(search.total).toBe(2);

    const wishlist = await listItems(deviceA, { ownership: ['wishlist'] });
    expect(wishlist.items).toHaveLength(1);

    const pastTheEnd = await listItems(deviceA, { page: 50, pageSize: 10 });
    expect(pastTheEnd).toMatchObject({ items: [], total: 3 });

    const first = all.items[0];
    expect(first && (await getItem(deviceA, first.id))).toMatchObject({ id: first?.id });
    expect(await getItem(deviceA, randomUUID())).toBeNull();
  });

  it('updates the copy fields of an item', async () => {
    const [item] = (await listItems(deviceA, { ownership: ['wishlist'] })).items;
    if (!item) throw new Error('No wishlist item.');
    const updated = await updateItem(deviceA, item.id, {
      ownership: 'owned',
      estimatedValue: 12.5,
      currency: 'EUR',
      notes: '  gift  ',
    });
    expect(updated).toMatchObject({
      ownership: 'owned',
      estimatedValue: 12.5,
      notes: 'gift',
      details: {},
    });
    await expect(updateItem(deviceA, randomUUID(), { quantity: 2 })).rejects.toBeInstanceOf(
      CollectionError,
    );
  });

  it('manages tags and filters by them', async () => {
    const tag = await createTag(deviceA, { name: 'Favourites', color: '#3b82f6' });
    await expect(createTag(deviceA, { name: 'Favourites' })).rejects.toMatchObject({
      code: 'duplicate',
    });
    expect(await listTags(deviceA)).toEqual([tag]);

    const [item] = (await listItems(deviceA, { search: 'matrix' })).items;
    if (!item) throw new Error('No Matrix item.');
    await assignTag(deviceA, item.id, tag.id);
    await assignTag(deviceA, item.id, tag.id); // already assigned: no error

    const tagged = await listItems(deviceA, { tagIds: [tag.id] });
    expect(tagged.items.map((entry) => entry.id)).toEqual([item.id]);
    expect(tagged.items[0]?.tagIds).toEqual([tag.id]);

    await unassignTag(deviceA, item.id, tag.id);
    expect((await listItems(deviceA, { tagIds: [tag.id] })).total).toBe(0);
    await deleteTag(deviceA, tag.id);
    expect(await listTags(deviceA)).toEqual([]);
  });

  it('counts the collection and its value', async () => {
    const stats = await getStats(deviceA);
    expect(stats.totals).toEqual({ items: 3, quantity: 3 });
    expect(stats.byCategory.movie.items).toBe(3);
    expect(stats.byOwnership.owned.items).toBe(3);
    expect(stats.estimatedValue).toEqual([{ currency: 'EUR', total: 12.5 }]);
  });

  it('sends a change on one device to the other within 2 seconds', async () => {
    const changes: CollectionChange[] = [];
    const unsubscribe = subscribeToCollectionChanges(deviceB, userId, {
      onChange: (change) => changes.push(change),
    });
    // Wait until device B has joined its topic.
    const channel = () => deviceB.getChannels().find((entry) => entry.state === 'joined');
    await vi.waitFor(() => expect(channel()).toBeDefined(), { timeout: 10_000 });

    const [item] = (await listItems(deviceA, { search: 'matrix' })).items;
    if (!item) throw new Error('No Matrix item.');
    await updateItem(deviceA, item.id, { quantity: 2 });

    await vi.waitFor(
      () =>
        expect(changes).toContainEqual({
          table: 'collection_items',
          operation: 'UPDATE',
          itemId: item.id,
        }),
      { timeout: 2000, interval: 50 },
    );
    unsubscribe();
  });

  it('deletes items one by one and in bulk', async () => {
    const { items } = await listItems(deviceA);
    const [first, ...rest] = items;
    if (!first) throw new Error('No items.');
    await deleteItem(deviceA, first.id);
    await expect(deleteItem(deviceA, first.id)).rejects.toMatchObject({ code: 'not_found' });

    expect(
      await bulkDelete(
        deviceA,
        rest.map((item) => item.id),
      ),
    ).toBe(rest.length);
    expect((await listItems(deviceA)).total).toBe(0);
  });
});
