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

/**
 * Key of a device's scanned files (FC-21). Outside `collectionKeys.all`, so collection mutations and
 * Realtime don't reload thousands of rows; the scanner hooks update it themselves.
 */
export const scannedFilesKey = (userId: string, deviceId: string) =>
  ['scanned-files', userId, deviceId] as const;

/**
 * Keys of the copy details the scanner took from an item's file headers (FC-23). Outside
 * `collectionKeys.all`; the background matcher refreshes them (`itemFileDetailsKeys.all`) when it
 * adds or fills copies.
 */
export const itemFileDetailsKeys = {
  all: (userId: string) => ['item-file-details', userId] as const,
  item: (userId: string, itemId: string) => [...itemFileDetailsKeys.all(userId), itemId] as const,
};

/** Key of the user's scanner settings (`profiles.preferences.scanner`, FC-23). */
export const scannerSettingsKey = (userId: string) => ['scanner-settings', userId] as const;

/**
 * Keys of the scanned files linked to an item (FC-24, the item page's "Files"). Outside
 * `collectionKeys.all`; Fix Match and the background matcher refresh them (`itemScannedFilesKeys.all`).
 */
export const itemScannedFilesKeys = {
  all: (userId: string) => ['item-scanned-files', userId] as const,
  item: (userId: string, itemId: string) => [...itemScannedFilesKeys.all(userId), itemId] as const,
};
