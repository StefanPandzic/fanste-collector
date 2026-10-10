import { COLLECTION_FACETS } from '@fanste/core';

import { toCollectionError } from '../errors';
import { toFilterJson } from './items';

import type { CollectionFacet, CollectionFacets, CollectionQuery } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

/** A row of `collection_facets()`. */
export interface FacetRow {
  facet: string;
  value: string;
  item_count: number;
}

/** Folds the rows of `collection_facets()` into counts per facet and value. Unknown facets are dropped. */
export function toCollectionFacets(rows: readonly FacetRow[]): CollectionFacets {
  const facets = Object.fromEntries(COLLECTION_FACETS.map((facet) => [facet, {}])) as Record<
    CollectionFacet,
    Record<string, number>
  >;
  for (const row of rows) {
    if (!(COLLECTION_FACETS as readonly string[]).includes(row.facet)) continue;
    facets[row.facet as CollectionFacet][row.value] = Number(row.item_count);
  }
  return facets;
}

/**
 * Items per value of each gallery filter for `query` (FC-18). Each facet applies every other filter
 * but its own; sort and paging are ignored.
 */
export async function getFacets(
  client: FansteSupabaseClient,
  query: CollectionQuery = {},
): Promise<CollectionFacets> {
  const { data, error } = await client.rpc('collection_facets', { p_filter: toFilterJson(query) });
  if (error) throw toCollectionError(error);
  return toCollectionFacets(data);
}
