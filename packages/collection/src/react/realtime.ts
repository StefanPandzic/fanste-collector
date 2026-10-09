import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { subscribeToCollectionChanges } from '../realtime/subscribe';
import { createBatcher } from '../timing';
import { useCollectionContext } from './context';
import { collectionKeys } from './query-keys';

import type { CollectionChange } from '../realtime/events';

/** Quiet time before a burst of changes is applied. */
const REALTIME_DEBOUNCE_MS = 300;
/** Above this many changed items, all detail queries are invalidated instead of one by one. */
const MAX_DETAIL_INVALIDATIONS = 50;

/**
 * Keeps the cached collection in sync with changes from other devices (and this one). Changes are
 * batched and only invalidate queries, so a scanner import or bulk delete costs one refetch per
 * active query. Mounted by `CollectionProvider`.
 */
export function useCollectionRealtime(): void {
  const { client, userId } = useCollectionContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateAll = () =>
      void queryClient.invalidateQueries({ queryKey: collectionKeys.all(userId) });

    const batcher = createBatcher<CollectionChange>(REALTIME_DEBOUNCE_MS, (changes) => {
      void queryClient.invalidateQueries({ queryKey: collectionKeys.lists(userId) });
      void queryClient.invalidateQueries({ queryKey: collectionKeys.stats(userId) });
      void queryClient.invalidateQueries({ queryKey: collectionKeys.copies(userId) });
      if (changes.some((change) => change.table === 'collection_item_tags')) {
        // Tags themselves aren't broadcast, but a new link may use a tag made on another device.
        void queryClient.invalidateQueries({ queryKey: collectionKeys.tags(userId) });
      }
      const ids = new Set(changes.map((change) => change.itemId));
      if (ids.size > MAX_DETAIL_INVALIDATIONS) {
        void queryClient.invalidateQueries({ queryKey: collectionKeys.details(userId) });
        return;
      }
      for (const id of ids) {
        void queryClient.invalidateQueries({ queryKey: collectionKeys.detail(userId, id) });
      }
    });

    const unsubscribe = subscribeToCollectionChanges(client, userId, {
      onChange: (change) => batcher.push(change),
      onResubscribed: invalidateAll,
    });
    return () => {
      unsubscribe();
      batcher.cancel();
    };
  }, [client, userId, queryClient]);
}
