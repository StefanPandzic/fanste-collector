import { queryOptions, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { EXTERNAL_PROVIDERS } from '@fanste/core';

import { refKey } from '../repository/copies';
import { metadataRetryDelay } from '../timing';
import { useCollectionContext } from './context';
import { collectionKeys, missingMetadataKey } from './query-keys';

import type { CollectionContextValue } from './context';
import type { CollectionItem, ExternalProvider, ItemRef } from '@fanste/core';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Refs of provider items whose metadata isn't cached yet, deduplicated and sorted (a stable query
 * key). Custom items and refs in `skip` (reported `not_found` before) are left out.
 */
export function missingMetadataRefs(
  items: readonly CollectionItem[],
  skip: ReadonlySet<string>,
): ItemRef[] {
  const refs = new Map<string, ItemRef>();
  for (const item of items) {
    if (item.metadata || item.externalId === null) continue;
    if (!(EXTERNAL_PROVIDERS as readonly string[]).includes(item.provider)) continue;
    const ref = { provider: item.provider as ExternalProvider, externalId: item.externalId };
    const key = refKey(ref);
    if (!skip.has(key)) refs.set(key, ref);
  }
  return [...refs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

/**
 * Query options that load the metadata of `items` that isn't in `metadata_cache` yet through
 * `/api/items/batch` (one request), which caches it, then refetch the collection queries so the
 * items show it. Refs the gateway deferred (`retry_later`) are asked for again with backoff;
 * `not_found` refs are never asked for again.
 */
function missingMetadataQuery(
  { api, userId, notFoundRefs }: CollectionContextValue,
  queryClient: QueryClient,
  items: readonly CollectionItem[] | undefined,
) {
  const refs = missingMetadataRefs(items ?? [], notFoundRefs);
  return queryOptions({
    queryKey: missingMetadataKey(userId, refs.map(refKey)),
    enabled: refs.length > 0,
    queryFn: async ({ signal }) => {
      const response = await api.getItemsBatch(refs, { signal });
      for (const missing of response.missing) {
        if (missing.reason === 'not_found') notFoundRefs.add(refKey(missing));
      }
      if (response.items.length > 0) {
        void queryClient.invalidateQueries({ queryKey: collectionKeys.lists(userId) });
        void queryClient.invalidateQueries({ queryKey: collectionKeys.details(userId) });
      }
      return response.missing.filter((missing) => missing.reason === 'retry_later').length;
    },
    staleTime: Infinity,
    // Ask again while the gateway still defers some refs; stop after a few tries. When a batch loads
    // some items, the remaining refs form a new key and are asked for at once (with a fresh attempt
    // count): each such round makes progress, so this ends after at most one round per ref.
    refetchInterval: (query) =>
      (query.state.data ?? 0) > 0 ? metadataRetryDelay(query.state.dataUpdateCount - 1) : false,
    refetchOnWindowFocus: false,
  });
}

/** Loads the metadata of `items` that isn't cached yet, in one batch request. */
export function useMissingMetadata(items: readonly CollectionItem[] | undefined): void {
  const context = useCollectionContext();
  const queryClient = useQueryClient();
  useQuery(missingMetadataQuery(context, queryClient, items));
}

/**
 * Like `useMissingMetadata` for several pages of items: one batch request per page, never one per
 * item. Keep pages at most `MAX_BATCH_ITEMS` long.
 */
export function useMissingMetadataPages(
  pages: readonly (readonly CollectionItem[] | undefined)[],
): void {
  const context = useCollectionContext();
  const queryClient = useQueryClient();
  useQueries({ queries: pages.map((items) => missingMetadataQuery(context, queryClient, items)) });
}
