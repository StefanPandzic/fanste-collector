import { toCollectionError } from '../errors';
import { collectionKeys, collectionMutationKey } from './query-keys';

import type { CollectionContextValue } from './context';
import type { QueryClient } from '@tanstack/react-query';

// Plumbing shared by the collection mutations. Several mutations may be in flight at once, so each
// one undoes only its own change on failure (never restoring a whole-cache snapshot, which would also
// revert the others), and the collection is refetched only when the last running mutation settles.

/** Reverts one mutation's optimistic change. */
export type Undo = () => void;

/** Stops in-flight refetches, so they can't overwrite the optimistic change with older data. */
export async function cancelRefetches(queryClient: QueryClient, userId: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: collectionKeys.all(userId) });
}

/**
 * Options shared by every collection mutation: one mutation key, undo and report on error, and a
 * refetch once no other collection mutation is running.
 */
export function mutationOptions(
  queryClient: QueryClient,
  { userId, onError }: CollectionContextValue,
) {
  const mutationKey = collectionMutationKey(userId);
  return {
    mutationKey,
    onError: (error: unknown, _variables: unknown, undo: Undo | undefined) => {
      undo?.();
      onError?.(toCollectionError(error));
    },
    onSettled: () => {
      // This mutation still counts as running here.
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: collectionKeys.all(userId) });
      }
    },
  };
}
