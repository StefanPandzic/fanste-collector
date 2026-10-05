// RLS integration tests against the dev Supabase Cloud project (FC-05). Run with `pnpm test:rls`.
//
// Each run creates two throwaway users (A and B) with the admin API and deletes them afterwards,
// which also removes all their rows (on delete cascade). Leftover users of crashed runs are removed
// at the start of the next run.
import { randomInt, randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createServiceClient } from './clients';
import { requireSupabaseEnv } from './config';

import type { FansteSupabaseClient } from './clients';
import type { Database } from './database.types';

const env = requireSupabaseEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
});

const TEST_EMAIL = /^rls-test-[0-9a-f-]+@example\.com$/;
// Older leftovers are from crashed runs; newer ones may belong to a run that is still going.
const LEFTOVER_AGE_MS = 60 * 60 * 1000;
// Postgres error codes returned by PostgREST.
const PERMISSION_DENIED = '42501'; // missing grant, or a row rejected by an RLS policy
const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

const USER_TABLES = [
  'profiles',
  'collection_items',
  'tags',
  'collection_item_tags',
  'scanned_files',
] as const;

interface TestUser {
  id: string;
  client: FansteSupabaseClient;
}

interface BroadcastEvent {
  event: string;
  table: unknown;
}

const admin = createServiceClient({
  url: env.NEXT_PUBLIC_SUPABASE_URL,
  secretKey: env.SUPABASE_SECRET_KEY,
});

/** A client with the publishable key and no session: the `anon` role until someone signs in. */
function createPublicClient(): FansteSupabaseClient {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

/** A TMDB movie ID far above the real ones, so test rows never clash with cached titles. */
function testMovieId(): string {
  return `movie:${randomInt(10 ** 12, 2 ** 47)}`;
}

async function createTestUser(): Promise<TestUser> {
  const email = `rls-test-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const client = createPublicClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function deleteLeftoverTestUsers(): Promise<void> {
  const cutoff = Date.now() - LEFTOVER_AGE_MS;
  const perPage = 1000;
  const leftovers: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      if (TEST_EMAIL.test(user.email ?? '') && Date.parse(user.created_at) < cutoff) {
        leftovers.push(user.id);
      }
    }
    if (data.users.length < perPage) break;
  }
  for (const id of leftovers) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.warn(`Could not delete leftover test user ${id}: ${error.message}`);
  }
}

/**
 * Joins a Broadcast topic and resolves with the first subscription status, e.g. `SUBSCRIBED` or
 * `CHANNEL_ERROR: <reason>`, and the events received so far.
 */
async function joinTopic(client: FansteSupabaseClient, topic: string, { isPrivate = true } = {}) {
  await client.realtime.setAuth();
  const events: BroadcastEvent[] = [];
  const channel = client
    .channel(topic, { config: { private: isPrivate } })
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      events.push({ event, table: (payload as { table?: unknown }).table });
    });
  const status = await new Promise<string>((resolve) => {
    channel.subscribe((state, error) => resolve(error ? `${state}: ${error.message}` : state));
  });
  return { channel, status, events };
}

describe('Row Level Security (dev Supabase project)', () => {
  const anon = createPublicClient();
  const cachedExternalId = testMovieId();
  const deletedUserIds = new Set<string>();
  let userA: TestUser;
  let userB: TestUser;
  let itemId: string;
  let tagId: string;
  let scannedFileId: string;

  beforeAll(async () => {
    await deleteLeftoverTestUsers();
    [userA, userB] = await Promise.all([createTestUser(), createTestUser()]);

    const cache = await admin.from('metadata_cache').insert({
      provider: 'tmdb',
      external_id: cachedExternalId,
      category: 'movie',
      title: 'RLS Test Movie',
      release_year: 1999,
    });
    if (cache.error) throw cache.error;

    const item = await userA.client
      .from('collection_items')
      .insert({
        category: 'movie',
        provider: 'tmdb',
        external_id: cachedExternalId,
        format: 'Blu-ray',
        metadata_overrides: { title: 'My Edited Title' },
        notes: 'original',
      })
      .select('id')
      .single();
    if (item.error) throw item.error;
    itemId = item.data.id;

    const tag = await userA.client
      .from('tags')
      .insert({ name: 'favourites' })
      .select('id')
      .single();
    if (tag.error) throw tag.error;
    tagId = tag.data.id;

    const link = await userA.client
      .from('collection_item_tags')
      .insert({ item_id: itemId, tag_id: tagId });
    if (link.error) throw link.error;

    const file = await userA.client
      .from('scanned_files')
      .insert({
        device_id: 'test-device',
        file_path: '/movies/test.mkv',
        collection_item_id: itemId,
      })
      .select('id')
      .single();
    if (file.error) throw file.error;
    scannedFileId = file.data.id;
  });

  afterAll(async () => {
    await Promise.all(
      [anon, userA?.client, userB?.client].map((client) => client?.removeAllChannels()),
    );
    for (const user of [userA, userB]) {
      if (!user || deletedUserIds.has(user.id)) continue;
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) console.warn(`Could not delete test user ${user.id}: ${error.message}`);
    }
    await admin.from('metadata_cache').delete().eq('external_id', cachedExternalId);
  });

  describe('anonymous visitors', () => {
    it.each([...USER_TABLES, 'metadata_cache'] as const)('cannot read %s', async (table) => {
      const { data, error } = await anon.from(table).select();
      expect(data).toBeNull();
      expect(error).toMatchObject({ code: PERMISSION_DENIED });
    });

    it('cannot read collection_items_view', async () => {
      const { data, error } = await anon.from('collection_items_view').select();
      expect(data).toBeNull();
      expect(error).toMatchObject({ code: PERMISSION_DENIED });
    });

    it('cannot add items', async () => {
      const { error } = await anon.from('collection_items').insert({
        category: 'movie',
        provider: 'tmdb',
        external_id: 'movie:603',
        user_id: userA.id,
      });
      expect(error).toMatchObject({ code: PERMISSION_DENIED });
    });
  });

  describe('profiles', () => {
    it('are created for new users, and each user sees only their own', async () => {
      const { data, error } = await userA.client.from('profiles').select('id');
      expect(error).toBeNull();
      expect(data).toEqual([{ id: userA.id }]);
    });
  });

  describe("another user's rows", () => {
    it.each(USER_TABLES)('are not readable in %s', async (table) => {
      const { data, error } = await userB.client.from(table).select();
      expect(error).toBeNull();
      // B's own profile is the only row B may see.
      expect(data).toEqual(table === 'profiles' ? [expect.objectContaining({ id: userB.id })] : []);
    });

    it('are not readable through collection_items_view', async () => {
      const { data } = await userB.client.from('collection_items_view').select();
      expect(data).toEqual([]);
    });

    it('cannot be updated', async () => {
      const item = await userB.client
        .from('collection_items')
        .update({ notes: 'changed by B' })
        .eq('id', itemId)
        .select();
      const tag = await userB.client
        .from('tags')
        .update({ name: 'changed by B' })
        .eq('id', tagId)
        .select();
      const file = await userB.client
        .from('scanned_files')
        .update({ match_status: 'ignored' })
        .eq('id', scannedFileId)
        .select();
      const profile = await userB.client
        .from('profiles')
        .update({ display_name: 'changed by B' })
        .eq('id', userA.id)
        .select();

      expect([item.data, tag.data, file.data, profile.data]).toEqual([[], [], [], []]);
      const { data } = await userA.client
        .from('collection_items')
        .select('notes')
        .eq('id', itemId)
        .single();
      expect(data?.notes).toBe('original');
    });

    it('cannot be deleted', async () => {
      const link = await userB.client
        .from('collection_item_tags')
        .delete()
        .eq('item_id', itemId)
        .select();
      const file = await userB.client
        .from('scanned_files')
        .delete()
        .eq('id', scannedFileId)
        .select();
      const tag = await userB.client.from('tags').delete().eq('id', tagId).select();
      const item = await userB.client.from('collection_items').delete().eq('id', itemId).select();

      expect([link.data, file.data, tag.data, item.data]).toEqual([[], [], [], []]);
      const { count } = await userA.client
        .from('collection_item_tags')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', itemId);
      expect(count).toBe(1);
    });

    it('cannot be created in the name of another user', async () => {
      const { error } = await userB.client.from('collection_items').insert({
        category: 'movie',
        provider: 'tmdb',
        external_id: 'movie:603',
        user_id: userA.id,
      });
      expect(error).toMatchObject({ code: PERMISSION_DENIED });
    });

    it('cannot be taken over by moving an own row to another user', async () => {
      const own = await userB.client.from('tags').insert({ name: 'moved' }).select('id').single();
      if (own.error) throw own.error;

      const { error } = await userB.client
        .from('tags')
        .update({ user_id: userA.id })
        .eq('id', own.data.id);
      expect(error).toMatchObject({ code: PERMISSION_DENIED });
    });

    it("cannot be linked to the user's own tags or items", async () => {
      const tag = await userB.client.from('tags').insert({ name: 'mine' }).select('id').single();
      if (tag.error) throw tag.error;
      const item = await userB.client
        .from('collection_items')
        .insert({ category: 'funko', provider: 'custom', custom_data: { title: 'Mine' } })
        .select('id')
        .single();
      if (item.error) throw item.error;

      const ownTagOnForeignItem = await userB.client
        .from('collection_item_tags')
        .insert({ item_id: itemId, tag_id: tag.data.id });
      const foreignTagOnOwnItem = await userB.client
        .from('collection_item_tags')
        .insert({ item_id: item.data.id, tag_id: tagId });
      const fileOfForeignItem = await userB.client.from('scanned_files').insert({
        device_id: 'test-device',
        file_path: '/movies/foreign.mkv',
        collection_item_id: itemId,
      });

      expect(ownTagOnForeignItem.error).toMatchObject({ code: FOREIGN_KEY_VIOLATION });
      expect(foreignTagOnOwnItem.error).toMatchObject({ code: FOREIGN_KEY_VIOLATION });
      expect(fileOfForeignItem.error).toMatchObject({ code: FOREIGN_KEY_VIOLATION });
    });
  });

  describe('collection_items_view', () => {
    it('shows metadata overrides over the cached provider metadata', async () => {
      const { data, error } = await userA.client
        .from('collection_items_view')
        .select('id, title, release_year, provider_title')
        .eq('id', itemId)
        .single();
      expect(error).toBeNull();
      expect(data).toEqual({
        id: itemId,
        title: 'My Edited Title',
        release_year: 1999,
        provider_title: 'RLS Test Movie',
      });
    });
  });

  describe('collection_items constraints', () => {
    it('allow the same title in another format but not twice in the same format', async () => {
      const copy = { category: 'movie', provider: 'tmdb', external_id: cachedExternalId } as const;
      const dvd = await userA.client.from('collection_items').insert({ ...copy, format: 'DVD' });
      const again = await userA.client
        .from('collection_items')
        .insert({ ...copy, format: ' dvd ' });
      expect(dvd.error).toBeNull();
      expect(again.error).toMatchObject({ code: UNIQUE_VIOLATION });
    });

    it('allow several custom items', async () => {
      const custom = { category: 'funko', provider: 'custom', format: 'Physical' } as const;
      const { error } = await userA.client.from('collection_items').insert([
        { ...custom, custom_data: { title: 'Funko A' } },
        { ...custom, custom_data: { title: 'Funko B' } },
      ]);
      expect(error).toBeNull();
    });

    it('require TMDB IDs prefixed with their category', async () => {
      const movie = { category: 'movie', provider: 'tmdb' } as const;
      const bare = await userA.client
        .from('collection_items')
        .insert({ ...movie, external_id: '603' });
      const wrongPrefix = await userA.client
        .from('collection_items')
        .insert({ ...movie, external_id: 'tv:1396' });
      expect(bare.error).toMatchObject({ code: CHECK_VIOLATION });
      expect(wrongPrefix.error).toMatchObject({ code: CHECK_VIOLATION });
    });
  });

  describe('scanned_files', () => {
    it('go back to review when their item is deleted', async () => {
      const item = await userA.client
        .from('collection_items')
        .insert({ category: 'funko', provider: 'custom', custom_data: { title: 'Unlinked' } })
        .select('id')
        .single();
      if (item.error) throw item.error;
      const file = await userA.client
        .from('scanned_files')
        .insert({
          device_id: 'test-device',
          file_path: '/movies/unlinked.mkv',
          collection_item_id: item.data.id,
          match_status: 'matched',
        })
        .select('id')
        .single();
      if (file.error) throw file.error;

      await userA.client.from('collection_items').delete().eq('id', item.data.id);

      const { data } = await userA.client
        .from('scanned_files')
        .select('collection_item_id, match_status')
        .eq('id', file.data.id)
        .single();
      expect(data).toEqual({ collection_item_id: null, match_status: 'unmatched' });
    });
  });

  describe('metadata_cache', () => {
    it('is readable by signed-in users', async () => {
      const { data } = await userB.client
        .from('metadata_cache')
        .select('title')
        .eq('external_id', cachedExternalId);
      expect(data).toEqual([{ title: 'RLS Test Movie' }]);
    });

    it('is not writable by signed-in users', async () => {
      const { error } = await userB.client.from('metadata_cache').insert({
        provider: 'tmdb',
        external_id: testMovieId(),
        category: 'movie',
        title: 'Written by B',
      });
      expect(error).toMatchObject({ code: PERMISSION_DENIED });
    });
  });

  describe('realtime', () => {
    it("sends a user's collection changes only to their own private topic", async () => {
      const topic = `user:${userA.id}`;
      const { status, events } = await joinTopic(userA.client, topic);
      expect(status).toBe('SUBSCRIBED');
      // Listening on the same topic as a public channel, which the `realtime.messages` policy doesn't
      // cover: the triggers send private messages only, so nothing may arrive there. The join itself
      // succeeds while the project allows public access, and fails once it's turned off (README).
      const publicB = await joinTopic(userB.client, topic, { isPrivate: false });
      const publicAnon = await joinTopic(anon, topic, { isPrivate: false });
      try {
        expect(publicB.status).toMatch(/^(SUBSCRIBED|CHANNEL_ERROR)/);
        expect(publicAnon.status).toMatch(/^(SUBSCRIBED|CHANNEL_ERROR)/);

        const item = await userA.client
          .from('collection_items')
          .insert({ category: 'funko', provider: 'custom', custom_data: { title: 'Realtime' } })
          .select('id')
          .single();
        if (item.error) throw item.error;
        await userA.client.from('collection_items').delete().eq('id', item.data.id);

        await vi.waitFor(
          () => {
            expect(events).toEqual(
              expect.arrayContaining([
                { event: 'INSERT', table: 'collection_items' },
                { event: 'DELETE', table: 'collection_items' },
              ]),
            );
          },
          { timeout: 15_000, interval: 250 },
        );
        // Give stray deliveries to the public listeners time to arrive.
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        expect([publicB.events, publicAnon.events]).toEqual([[], []]);
      } finally {
        // A client keeps one channel per topic, so B's private join below needs a fresh one.
        await userB.client.removeChannel(publicB.channel);
        await anon.removeChannel(publicAnon.channel);
      }
    });

    it("does not let a user join another user's topic", async () => {
      const { status } = await joinTopic(userB.client, `user:${userA.id}`);
      expect(status).toMatch(/^CHANNEL_ERROR/);
    });
  });

  describe('deleting a user', () => {
    it("removes all of the user's rows", async () => {
      const { error } = await admin.auth.admin.deleteUser(userA.id);
      expect(error).toBeNull();
      deletedUserIds.add(userA.id);

      const head = { count: 'exact', head: true } as const;
      const counts = await Promise.all([
        admin.from('profiles').select('*', head).eq('id', userA.id),
        admin.from('collection_items').select('*', head).eq('user_id', userA.id),
        admin.from('tags').select('*', head).eq('user_id', userA.id),
        admin.from('collection_item_tags').select('*', head).eq('user_id', userA.id),
        admin.from('scanned_files').select('*', head).eq('user_id', userA.id),
      ]);
      expect(counts.map(({ count }) => count)).toEqual([0, 0, 0, 0, 0]);
    });
  });
});
