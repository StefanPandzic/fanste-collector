import { fromMetadataCacheRow, toMetadataCacheRow } from '@fanste/core';

import { PROVIDER_LIMITS } from '../limits';

import type { ExternalProvider, ItemRef, NormalizedItem } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

export interface CachedItem {
  item: NormalizedItem;
  fetchedAt: Date;
}

/** The shared `metadata_cache` table (FC-05), the gateway's primary cache. */
export interface MetadataCacheStore {
  /** The cached rows among `refs`, in no particular order. */
  getMany(refs: readonly ItemRef[]): Promise<CachedItem[]>;
  /** Inserts or replaces the rows of `items` and marks them as fetched now. */
  upsert(items: readonly NormalizedItem[]): Promise<void>;
}

/** Whether a row fetched at `fetchedAt` is older than its provider's TTL. */
export function isStale(fetchedAt: Date, provider: ExternalProvider, now = new Date()): boolean {
  return now.getTime() - fetchedAt.getTime() > PROVIDER_LIMITS[provider].cacheTtlMs;
}

/** The key of an item in maps and sets: `provider/externalId`. */
export function refKey(ref: { provider: string; externalId: string }): string {
  return `${ref.provider}/${ref.externalId}`;
}

/**
 * `metadata_cache` through Supabase. Signed-in users may only read the table, so `client` must be
 * the service client (`createSupabaseServiceClient()`).
 */
export function createSupabaseMetadataCache(client: FansteSupabaseClient): MetadataCacheStore {
  return {
    async getMany(refs) {
      const idsByProvider = new Map<ExternalProvider, string[]>();
      for (const ref of refs) {
        idsByProvider.set(ref.provider, [
          ...(idsByProvider.get(ref.provider) ?? []),
          ref.externalId,
        ]);
      }

      // One query per provider; a gallery usually spans one to four.
      const results = await Promise.all(
        [...idsByProvider].map(([provider, ids]) =>
          client.from('metadata_cache').select('*').eq('provider', provider).in('external_id', ids),
        ),
      );
      return results.flatMap(({ data, error }) => {
        if (error) throw new Error(`metadata_cache read failed: ${error.message}`);
        return data.map((row) => ({
          item: fromMetadataCacheRow(row),
          fetchedAt: new Date(row.fetched_at),
        }));
      });
    },

    async upsert(items) {
      if (items.length === 0) return;
      // `fetched_at` only defaults on insert, so set it for updates too.
      const fetchedAt = new Date().toISOString();
      const rows = items.map((item) => ({ ...toMetadataCacheRow(item), fetched_at: fetchedAt }));
      const { error } = await client
        .from('metadata_cache')
        .upsert(rows, { onConflict: 'provider,external_id' });
      if (error) throw new Error(`metadata_cache write failed: ${error.message}`);
    },
  };
}
