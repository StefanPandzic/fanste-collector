import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toCollectionError } from '../errors';
import {
  addToPage,
  applyPatch,
  isOptimisticId,
  OPTIMISTIC_ID_PREFIX,
  removeFromPage,
  restoreToPage,
  undoAddToPage,
  updateInPage,
} from './cache-updates';
import { useCollectionContext } from './context';
import { useMissingMetadata } from './missing-metadata';
import { collectionKeys, collectionMutationKey } from './query-keys';
import {
  addItem,
  bulkDelete,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from '../repository/items';
import { getStats } from '../repository/stats';
import {
  assignTag,
  createTag,
  deleteTag,
  listTags,
  unassignTag,
  updateTag,
} from '../repository/tags';

import type { CollectionContextValue } from './context';
import type { CollectionPage } from '../repository/items';
import type {
  AddItemInput,
  CollectionItem,
  CollectionQuery,
  NormalizedItem,
  Tag,
  TagInput,
  UpdateItemPatch,
} from '@fanste/core';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Collection data changes on other devices too. Realtime invalidates it, but refetch when the window
 * regains focus or the network comes back, in case events were missed meanwhile.
 */
const LIVE_QUERY = {
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const;

// ---------------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------------

/**
 * A page of the user's collection. The previous page stays visible while the next one loads, and
 * metadata that isn't cached yet is loaded through the gateway.
 */
export function useCollection(query: CollectionQuery = {}) {
  const { client, userId } = useCollectionContext();
  const result = useQuery({
    queryKey: collectionKeys.list(userId, query),
    queryFn: () => listItems(client, query),
    placeholderData: keepPreviousData,
    ...LIVE_QUERY,
  });
  useMissingMetadata(result.data?.items);
  return result;
}

/** One item, or `null` if it doesn't exist. */
export function useCollectionItem(id: string | undefined) {
  const { client, userId } = useCollectionContext();
  const result = useQuery({
    queryKey: collectionKeys.detail(userId, id ?? ''),
    queryFn: () => getItem(client, id ?? ''),
    enabled: id !== undefined,
    ...LIVE_QUERY,
  });
  useMissingMetadata(result.data ? [result.data] : undefined);
  return result;
}

export function useTags() {
  const { client, userId } = useCollectionContext();
  return useQuery({
    queryKey: collectionKeys.tags(userId),
    queryFn: () => listTags(client),
    ...LIVE_QUERY,
  });
}

export function useCollectionStats() {
  const { client, userId } = useCollectionContext();
  return useQuery({
    queryKey: collectionKeys.stats(userId),
    queryFn: () => getStats(client),
    ...LIVE_QUERY,
  });
}

// ---------------------------------------------------------------------------------------------------
// Optimistic update plumbing
// ---------------------------------------------------------------------------------------------------
//
// Several mutations may be in flight at once, so each one undoes only its own change on failure
// (never restoring a whole-cache snapshot, which would also revert the others), and the collection
// is refetched only when the last running mutation settles.

/** Reverts one mutation's optimistic change. */
type Undo = () => void;

/** Stops in-flight refetches, so they can't overwrite the optimistic change with older data. */
async function cancelRefetches(queryClient: QueryClient, userId: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: collectionKeys.all(userId) });
}

function cachedLists(queryClient: QueryClient, userId: string): [QueryKey, CollectionPage][] {
  return queryClient
    .getQueriesData<CollectionPage>({ queryKey: collectionKeys.lists(userId) })
    .filter((entry): entry is [QueryKey, CollectionPage] => entry[1] !== undefined);
}

/** The query a list page was loaded for: the last element of its key (see `collectionKeys.list`). */
function queryOfKey(key: QueryKey): CollectionQuery {
  return key[key.length - 1] as CollectionQuery;
}

/** Applies `update` to every cached list page. */
function updateLists(
  queryClient: QueryClient,
  userId: string,
  update: (page: CollectionPage, query: CollectionQuery) => CollectionPage,
): void {
  for (const [key, page] of cachedLists(queryClient, userId)) {
    queryClient.setQueryData(key, update(page, queryOfKey(key)));
  }
}

/** Applies `update` to an item in every cached list and its detail query. */
function updateItemEverywhere(
  queryClient: QueryClient,
  userId: string,
  id: string,
  update: (item: CollectionItem) => CollectionItem,
): void {
  updateLists(queryClient, userId, (page) => updateInPage(page, id, update));
  queryClient.setQueryData<CollectionItem | null>(collectionKeys.detail(userId, id), (item) =>
    item ? update(item) : item,
  );
}

/** The cached version of an item (detail first, then any list), for undoing changes to it. */
function cachedItem(
  queryClient: QueryClient,
  userId: string,
  id: string,
): CollectionItem | undefined {
  const detail = queryClient.getQueryData<CollectionItem | null>(collectionKeys.detail(userId, id));
  if (detail) return detail;
  for (const [, page] of cachedLists(queryClient, userId)) {
    const item = page.items.find((entry) => entry.id === id);
    if (item) return item;
  }
  return undefined;
}

/**
 * Options shared by every collection mutation: one mutation key, undo and report on error, and a
 * refetch once no other collection mutation is running.
 */
function mutationOptions(queryClient: QueryClient, { userId, onError }: CollectionContextValue) {
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

let optimisticIds = 0;

// ---------------------------------------------------------------------------------------------------
// Item mutations
// ---------------------------------------------------------------------------------------------------

export interface AddItemVariables {
  input: AddItemInput;
  /** Metadata the caller already has (e.g. the search result), so the optimistic card has a title. */
  metadata?: NormalizedItem;
}

/**
 * Adds a copy of a provider item: loads its metadata through the gateway (which caches it), then
 * inserts the row. The item shows up in newest-first lists at once and is removed again on failure.
 */
export function useAddItem() {
  const context = useCollectionContext();
  const { client, api, userId } = context;
  const queryClient = useQueryClient();
  const options = mutationOptions(queryClient, context);

  return useMutation({
    ...options,
    mutationFn: ({ input }: AddItemVariables) =>
      addItem(client, input, { getMetadata: (ref) => api.getItem(ref) }),
    onMutate: async ({ input, metadata }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const now = new Date().toISOString();
      const optimistic: CollectionItem = {
        id: `${OPTIMISTIC_ID_PREFIX}${++optimisticIds}`,
        userId,
        category: input.category,
        provider: input.provider,
        externalId: input.externalId,
        format: input.format ?? null,
        details: input.details ?? {},
        metadataOverrides: {},
        ownership: input.ownership ?? 'owned',
        quantity: input.quantity ?? 1,
        acquiredAt: input.acquiredAt ?? null,
        purchasePrice: input.purchasePrice ?? null,
        estimatedValue: input.estimatedValue ?? null,
        currency: input.currency ?? null,
        notes: input.notes ?? null,
        source: input.source ?? 'manual',
        createdAt: now,
        updatedAt: now,
        tagIds: [],
        metadata: metadata ?? null,
      };

      const changed: { key: QueryKey; written: CollectionPage }[] = [];
      for (const [key, page] of cachedLists(queryClient, userId)) {
        const next = addToPage(page, optimistic, queryOfKey(key));
        if (next === page) continue;
        changed.push({ key, written: next });
        queryClient.setQueryData(key, next);
      }
      return () => {
        for (const { key, written } of changed) {
          queryClient.setQueryData<CollectionPage>(key, (page) => {
            if (!page) return page;
            // Undo the total only on the page this add wrote; a refetched page is already right.
            if (page === written) return undoAddToPage(page, optimistic.id);
            return removeFromPage(page, new Set([optimistic.id]));
          });
        }
      };
    },
    onSuccess: (item, _variables, undo) => {
      // Swap the optimistic row for the stored one (other mutations may delay the refetch).
      undo();
      updateLists(queryClient, userId, (page, query) => addToPage(page, item, query));
    },
  });
}

export interface UpdateItemVariables {
  id: string;
  patch: UpdateItemPatch;
}

/** Updates the copy fields of an item, optimistically. */
export function useUpdateItem() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions(queryClient, context),
    mutationFn: ({ id, patch }: UpdateItemVariables) => updateItem(client, id, patch),
    onMutate: async ({ id, patch }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const before = cachedItem(queryClient, userId, id);
      updateItemEverywhere(queryClient, userId, id, (item) => applyPatch(item, patch));
      return () => {
        if (!before) return;
        // Revert only the patched fields, keeping other changes to the item.
        const fields = Object.keys(patch) as (keyof UpdateItemPatch)[];
        const reverted = Object.fromEntries(fields.map((field) => [field, before[field]]));
        updateItemEverywhere(queryClient, userId, id, (item) => ({ ...item, ...reverted }));
      };
    },
  });
}

/**
 * Removes items from every cached list and detail; the returned undo puts them back. Items still
 * being added are skipped: they have no row to delete yet and would come back when the add lands.
 */
function removeOptimistically(
  queryClient: QueryClient,
  userId: string,
  ids: readonly string[],
): Undo {
  const set = new Set(ids.filter((id) => !isOptimisticId(id)));
  const removed: { key: QueryKey; item: CollectionItem; index: number }[] = [];
  for (const [key, page] of cachedLists(queryClient, userId)) {
    page.items.forEach((item, index) => {
      if (set.has(item.id)) removed.push({ key, item, index });
    });
    queryClient.setQueryData(key, removeFromPage(page, set));
  }
  const details = [...set].map((id) => {
    const key = collectionKeys.detail(userId, id);
    const item = queryClient.getQueryData<CollectionItem | null>(key);
    queryClient.setQueryData(key, null);
    return { key, item };
  });

  return () => {
    for (const { key, item, index } of removed) {
      queryClient.setQueryData<CollectionPage>(key, (page) =>
        page ? restoreToPage(page, item, index) : page,
      );
    }
    for (const { key, item } of details) {
      if (item !== undefined) queryClient.setQueryData(key, item);
    }
  };
}

/**
 * Deletes one item, optimistically. An item that is still being added (`isOptimisticId`) can't be
 * deleted yet; disable the action for it.
 */
export function useDeleteItem() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions(queryClient, context),
    mutationFn: (id: string) => deleteItem(client, id),
    onMutate: async (id): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      return removeOptimistically(queryClient, userId, [id]);
    },
  });
}

/** Deletes many items, optimistically. Resolves to the number deleted. */
export function useBulkDeleteItems() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions(queryClient, context),
    mutationFn: (ids: readonly string[]) =>
      bulkDelete(
        client,
        ids.filter((id) => !isOptimisticId(id)),
      ),
    onMutate: async (ids): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      return removeOptimistically(queryClient, userId, ids);
    },
  });
}

// ---------------------------------------------------------------------------------------------------
// Tag mutations
// ---------------------------------------------------------------------------------------------------

/** Creates, renames and deletes tags. The tag list updates optimistically. */
export function useTagMutations() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();
  const options = mutationOptions(queryClient, context);
  const tagsKey = collectionKeys.tags(userId);

  const setTags = (update: (tags: Tag[]) => Tag[]) =>
    queryClient.setQueryData<Tag[]>(tagsKey, (tags) => (tags ? update(tags) : tags));
  const cachedTag = (id: string) =>
    queryClient.getQueryData<Tag[]>(tagsKey)?.find((tag) => tag.id === id);

  const create = useMutation({
    ...options,
    mutationFn: (input: TagInput) => createTag(client, input),
  });

  const update = useMutation({
    ...options,
    mutationFn: ({ id, input }: { id: string; input: Partial<TagInput> }) =>
      updateTag(client, id, input),
    onMutate: async ({ id, input }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const before = cachedTag(id);
      setTags((tags) =>
        tags.map((tag) =>
          tag.id === id
            ? { ...tag, name: input.name?.trim() ?? tag.name, color: input.color ?? tag.color }
            : tag,
        ),
      );
      return () => {
        if (before) setTags((tags) => tags.map((tag) => (tag.id === id ? before : tag)));
      };
    },
  });

  const remove = useMutation({
    ...options,
    mutationFn: (id: string) => deleteTag(client, id),
    onMutate: async (id): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const tags = queryClient.getQueryData<Tag[]>(tagsKey) ?? [];
      const index = tags.findIndex((tag) => tag.id === id);
      const before = tags[index];
      setTags((list) => list.filter((tag) => tag.id !== id));
      return () => {
        if (!before) return;
        setTags((list) =>
          list.some((tag) => tag.id === id) ? list : list.toSpliced(index, 0, before),
        );
      };
    },
  });

  return { create, update, remove };
}

export interface TagLinkVariables {
  itemId: string;
  tagId: string;
}

/** Puts tags on items and takes them off, optimistically. */
export function useTagAssignment() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();
  const options = mutationOptions(queryClient, context);

  const add = (tagId: string) => (ids: string[]) => (ids.includes(tagId) ? ids : [...ids, tagId]);
  const drop = (tagId: string) => (ids: string[]) => ids.filter((id) => id !== tagId);

  function setTagIds(itemId: string, change: (tagIds: string[]) => string[]) {
    updateItemEverywhere(queryClient, userId, itemId, (item) => ({
      ...item,
      tagIds: change(item.tagIds),
    }));
  }

  const assign = useMutation({
    ...options,
    mutationFn: ({ itemId, tagId }: TagLinkVariables) => assignTag(client, itemId, tagId),
    onMutate: async ({ itemId, tagId }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const had = cachedItem(queryClient, userId, itemId)?.tagIds.includes(tagId) ?? false;
      setTagIds(itemId, add(tagId));
      return () => {
        if (!had) setTagIds(itemId, drop(tagId));
      };
    },
  });

  const unassign = useMutation({
    ...options,
    mutationFn: ({ itemId, tagId }: TagLinkVariables) => unassignTag(client, itemId, tagId),
    onMutate: async ({ itemId, tagId }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const had = cachedItem(queryClient, userId, itemId)?.tagIds.includes(tagId) ?? false;
      setTagIds(itemId, drop(tagId));
      return () => {
        if (had) setTagIds(itemId, add(tagId));
      };
    },
  });

  return { assign, unassign };
}
