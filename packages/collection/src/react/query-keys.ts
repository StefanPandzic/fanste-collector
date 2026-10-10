import { collectionQuerySchema } from '@fanste/core';

import { toFilterJson } from '../repository/items';

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
  /** Filter counts of the gallery; keyed by the filters only (sort and paging don't change them). */
  facets: (userId: string, query: CollectionQuery) =>
    [...collectionKeys.all(userId), 'facets', toFilterJson(query)] as const,
  copies: (userId: string) => [...collectionKeys.all(userId), 'copies'] as const,
  /** The user's copies of some provider items (`refKey`s, sorted), e.g. for search results. */
  copiesOf: (userId: string, refKeys: readonly string[]) =>
    [...collectionKeys.copies(userId), refKeys] as const,
};

/** Mutation key shared by every collection mutation, to tell when the last one has settled. */
export const collectionMutationKey = (userId: string) => ['collection-mutation', userId] as const;

/**
 * Key of the missing-metadata fetches. Deliberately outside `collectionKeys.all`, so invalidating
 * the collection (after every mutation, on Realtime resubscribe) doesn't fire them again.
 */
export const missingMetadataKey = (userId: string, refKeys: readonly string[]) =>
  ['collection-missing-metadata', userId, refKeys] as const;

/**
 * Key of the user's last-used copy details per category (`profiles.preferences`). Outside
 * `collectionKeys.all`, so collection mutations don't refetch or cancel it.
 */
export const copyDefaultsKey = (userId: string) => ['collection-copy-defaults', userId] as const;
