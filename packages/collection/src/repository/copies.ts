import { toCollectionError } from '../errors';

import type { ExternalProvider, ItemRef, OwnershipStatus } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

/** A copy the user has of a provider item, as search results show it ("In collection"). */
export interface ItemCopy {
  id: string;
  format: string | null;
  ownership: OwnershipStatus;
}

/** The user's copies of each requested item, keyed by `refKey`; `[]` when they have none. */
export type CopiesByRef = Record<string, ItemCopy[]>;

/** `provider:externalId`, e.g. `tmdb:movie:603`. */
export function refKey(ref: ItemRef): string {
  return `${ref.provider}:${ref.externalId}`;
}

/** External IDs per request, so the `in.(...)` filter stays well within URL limits. */
const LOOKUP_CHUNK = 100;

/**
 * The user's copies of the given provider items (RLS limits the query to their rows), e.g. to mark
 * search results that are already in the collection.
 */
export async function findCopies(
  client: FansteSupabaseClient,
  refs: readonly ItemRef[],
): Promise<CopiesByRef> {
  const copies: CopiesByRef = Object.fromEntries(refs.map((ref) => [refKey(ref), []]));
  const byProvider = new Map<ExternalProvider, string[]>();
  for (const ref of refs) {
    const ids = byProvider.get(ref.provider) ?? [];
    if (!ids.includes(ref.externalId)) ids.push(ref.externalId);
    byProvider.set(ref.provider, ids);
  }

  for (const [provider, ids] of byProvider) {
    for (let start = 0; start < ids.length; start += LOOKUP_CHUNK) {
      const { data, error } = await client
        .from('collection_items')
        .select('id, external_id, format, ownership')
        .eq('provider', provider)
        .in('external_id', ids.slice(start, start + LOOKUP_CHUNK))
        .order('created_at', { ascending: true });
      if (error) throw toCollectionError(error);
      for (const row of data) {
        if (row.external_id === null) continue;
        const key = refKey({ provider, externalId: row.external_id });
        copies[key]?.push({ id: row.id, format: row.format, ownership: row.ownership });
      }
    }
  }
  return copies;
}
