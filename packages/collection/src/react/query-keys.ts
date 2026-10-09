import { collectionQuerySchema } from '@fanste/core';

import type { CollectionQuery } from '@fanste/core';

/**
 * TanStack Query keys of the collection. Every key starts with the user's ID, so two accounts in one
 * session never share cached rows.
 */
export const collectionKeys = {
  all: (userId: string) => ['collection', userId] as const,
  lists: (userId: string) => [...collectionKeys.all(userId), 'list'] as const,
  /** The query is normalized (defaults filled in), so equal queries share one cache entry. */
  list: (userId: string, query: CollectionQuery) =>
    [...collectionKeys.lists(userId), collectionQuerySchema.parse(query)] as const,
  details: (userId: string) => [...collectionKeys.all(userId), 'item'] as const,
  detail: (userId: string, id: string) => [...collectionKeys.details(userId), id] as const,
  tags: (userId: string) => [...collectionKeys.all(userId), 'tags'] as const,
  stats: (userId: string) => [...collectionKeys.all(userId), 'stats'] as const,
};

/** Mutation key shared by every collection mutation, to tell when the last one has settled. */
export const collectionMutationKey = (userId: string) => ['collection-mutation', userId] as const;

/**
 * Key of the missing-metadata fetches. Deliberately outside `collectionKeys.all`, so invalidating
 * the collection (after every mutation, on Realtime resubscribe) doesn't fire them again.
 */
export const missingMetadataKey = (userId: string, refKeys: readonly string[]) =>
  ['collection-missing-metadata', userId, refKeys] as const;
