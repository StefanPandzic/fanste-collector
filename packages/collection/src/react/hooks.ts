import {
  keepPreviousData,
  queryOptions,
  useQueries,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  COPY_DETAIL_STATUSES,
  copyDefaultsFrom,
  detailsPatchSchemaFor,
  overridesPatchSchema,
} from '@fanste/core';

import { toCollectionError } from '../errors';
import {
  addCopy,
  addToPage,
  applyPatch,
  isOptimisticId,
  mergePages,
  mergeRecord,
  OPTIMISTIC_ID_PREFIX,
  removeCopy,
  removeFromPage,
  restoreToPage,
  undoAddToPage,
  updateInPage,
} from './cache-updates';
import { useCollectionContext } from './context';
import { useMissingMetadata, useMissingMetadataPages } from './missing-metadata';
import { collectionKeys, collectionMutationKey, copyDefaultsKey } from './query-keys';
import { findCopies, refKey } from '../repository/copies';
import {
  getCopyDefaults,
  resetAllOverrides,
  resetOverride,
  saveCopyDefaults,
  updateItemDetails,
  updateOverrides,
} from '../repository/details';
import { getFacets } from '../repository/facets';
import {
  addItem,
  bulkDelete,
  bulkUpdateItems,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from '../repository/items';
import { getStats } from '../repository/stats';
import {
  assignTag,
  bulkAssignTag,
  createTag,
  deleteTag,
  listTags,
  unassignTag,
  updateTag,
} from '../repository/tags';

import type { CollectionContextValue } from './context';
import type { CopiesByRef } from '../repository/copies';
import type { DetailsChange } from '../repository/details';
import type { CollectionPage } from '../repository/items';
import type {
  AddItemInput,
  CollectionItem,
  CollectionQuery,
  ItemRef,
  NormalizedItem,
  OverridableField,
  OverridesPatch,
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

/** The first `pageCount` pages of a query, as one list (see `useCollectionPages`). */
export interface CollectionPages {
  /** The loaded items in order. An item that moved to a later page while loading shows once. */
  items: CollectionItem[];
  /** All items matching the filters; `undefined` until the first page has loaded. */
  total: number | undefined;
  /** More items match than are loaded: load the next page. */
  hasMore: boolean;
  /** Nothing to show yet. */
  isPending: boolean;
  isFetching: boolean;
  /** A page after the first is loading. */
  isFetchingNextPage: boolean;
  /** The items are from the previous query while the new first page loads. */
  isPlaceholderData: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Pages 1…`pageCount` of the collection for infinite scrolling, e.g. the gallery (FC-18). Each page
 * is its own cached list, so optimistic updates reach it, and loads its missing metadata in one
 * batch: keep `pageSize` at most `MAX_BATCH_ITEMS`. While the filters change, the previous results
 * stay visible (`isPlaceholderData`); reset `pageCount` to 1 when they do.
 */
export function useCollectionPages(query: CollectionQuery, pageCount: number): CollectionPages {
  const { client, userId } = useCollectionContext();
  const pageQuery = (page: number) => ({ ...query, page });

  const first = useQuery({
    queryKey: collectionKeys.list(userId, pageQuery(1)),
    queryFn: () => listItems(client, pageQuery(1)),
    placeholderData: keepPreviousData,
    ...LIVE_QUERY,
  });
  const rest = useQueries({
    queries: Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => ({
      queryKey: collectionKeys.list(userId, pageQuery(index + 2)),
      queryFn: () => listItems(client, pageQuery(index + 2)),
      // Pages after the first wait for it, so they never mix with placeholder data.
      enabled: !first.isPlaceholderData,
      ...LIVE_QUERY,
    })),
  });
  const pages = first.isPlaceholderData ? [first.data] : [first.data, ...rest.map((r) => r.data)];
  useMissingMetadataPages(pages.map((page) => page?.items));

  const { items, hasMore } = mergePages(pages);
  const total = first.data?.total;
  const isFetchingNextPage = !first.isPlaceholderData && rest.some((r) => r.isFetching);
  return {
    items,
    total,
    hasMore,
    isPending: first.isPending,
    isFetching: first.isFetching || isFetchingNextPage,
    isFetchingNextPage,
    isPlaceholderData: first.isPlaceholderData,
    error: first.error ?? rest.find((r) => r.error)?.error ?? null,
    refetch: () => {
      void first.refetch();
      for (const page of rest) void page.refetch();
    },
  };
}

/**
 * Items per value of each gallery filter for `query` ("Blu-ray (12)"). The previous counts stay
 * visible while the filters change.
 */
export function useCollectionFacets(query: CollectionQuery = {}) {
  const { client, userId } = useCollectionContext();
  return useQuery({
    queryKey: collectionKeys.facets(userId, query),
    queryFn: () => getFacets(client, query),
    placeholderData: keepPreviousData,
    ...LIVE_QUERY,
  });
}

/**
 * The user's copies of some provider items, e.g. to mark search results already in the collection.
 * Keeps showing the previous answer while the refs change (more results loaded).
 */
export function useCollectionCopies(refs: readonly ItemRef[]) {
  const { client, userId } = useCollectionContext();
  const keys = [...new Set(refs.map(refKey))].sort();
  return useQuery({
    queryKey: collectionKeys.copiesOf(userId, keys),
    queryFn: () => findCopies(client, refs),
    enabled: keys.length > 0,
    placeholderData: keepPreviousData,
    ...LIVE_QUERY,
  });
}

/** The user's last-used medium and details per category: the `defaults` of `prefillDetails`. */
export function useCopyDefaults() {
  const { client, userId } = useCollectionContext();
  return useQuery(copyDefaultsQuery(client, userId));
}

/**
 * Query options of the user's last-used values, for loading them outside a component, e.g.
 * `queryClient.fetchQuery(copyDefaultsQuery(client, userId))` before a quick add.
 */
export function copyDefaultsQuery(client: CollectionContextValue['client'], userId: string) {
  return queryOptions({
    queryKey: copyDefaultsKey(userId),
    queryFn: () => getCopyDefaults(client),
    staleTime: 5 * 60 * 1000,
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

/** Applies `update` to every cached copies lookup (`useCollectionCopies`). */
function updateCopies(
  queryClient: QueryClient,
  userId: string,
  update: (copies: CopiesByRef) => CopiesByRef,
): void {
  queryClient.setQueriesData<CopiesByRef>({ queryKey: collectionKeys.copies(userId) }, (copies) =>
    copies ? update(copies) : copies,
  );
}

function toCopy({ id, format, ownership }: CollectionItem) {
  return { id, format, ownership };
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
      const copyKey = refKey({ provider: input.provider, externalId: input.externalId });
      updateCopies(queryClient, userId, (copies) => addCopy(copies, copyKey, toCopy(optimistic)));
      return () => {
        updateCopies(queryClient, userId, (copies) => removeCopy(copies, copyKey, optimistic.id));
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
    onSuccess: (item, { input }, undo) => {
      // Swap the optimistic row for the stored one (other mutations may delay the refetch).
      undo();
      updateLists(queryClient, userId, (page, query) => addToPage(page, item, query));
      if (item.externalId !== null) {
        const copyKey = refKey({ provider: input.provider, externalId: item.externalId });
        updateCopies(queryClient, userId, (copies) => addCopy(copies, copyKey, toCopy(item)));
      }
      // Remember the medium and detail habits for the next add of this category. Only copies the
      // user has carry details, and scanner imports aren't the user's choice.
      if (COPY_DETAIL_STATUSES.includes(item.ownership) && input.source !== 'scanner') {
        rememberCopyDefaults(item);
      }
    },
  });

  function rememberCopyDefaults(item: CollectionItem): void {
    const key = copyDefaultsKey(userId);
    const defaults = copyDefaultsFrom(item.category, item.format, item.details);
    queryClient.setQueryData<Awaited<ReturnType<typeof getCopyDefaults>>>(key, (current) =>
      current ? { ...current, [item.category]: defaults } : current,
    );
    // Best effort: failing to remember a default must not fail the add.
    saveCopyDefaults(client, item.category, defaults).then(
      () => queryClient.invalidateQueries({ queryKey: key }),
      () => undefined,
    );
  }
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
      return patchOptimistically(queryClient, userId, id, patch);
    },
  });
}

/** Applies a copy-field patch to a cached item; the undo reverts only the patched fields. */
function patchOptimistically(
  queryClient: QueryClient,
  userId: string,
  id: string,
  patch: UpdateItemPatch,
): Undo {
  const before = cachedItem(queryClient, userId, id);
  updateItemEverywhere(queryClient, userId, id, (item) => applyPatch(item, patch));
  return () => {
    if (!before) return;
    // Keep other changes to the item.
    const fields = Object.keys(patch) as (keyof UpdateItemPatch)[];
    const reverted = Object.fromEntries(fields.map((field) => [field, before[field]]));
    updateItemEverywhere(queryClient, userId, id, (item) => ({ ...item, ...reverted }));
  };
}

export interface BulkUpdateItemsVariables {
  ids: readonly string[];
  patch: UpdateItemPatch;
}

/**
 * Applies the same copy-field patch to many items, optimistically, e.g. a bulk ownership change.
 * Resolves to the number updated. Items still being added are skipped.
 */
export function useBulkUpdateItems() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions(queryClient, context),
    mutationFn: ({ ids, patch }: BulkUpdateItemsVariables) =>
      bulkUpdateItems(
        client,
        ids.filter((id) => !isOptimisticId(id)),
        patch,
      ),
    onMutate: async ({ ids, patch }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const undos = ids
        .filter((id) => !isOptimisticId(id))
        .map((id) => patchOptimistically(queryClient, userId, id, patch));
      return () => {
        for (const undo of undos) undo();
      };
    },
  });
}

type JsonField = 'details' | 'metadataOverrides';

/**
 * Optimistically merges `patch` into a jsonb field of an item. The undo puts back only the patched
 * keys, keeping other changes to the field.
 */
function mergeOptimistically(
  queryClient: QueryClient,
  userId: string,
  id: string,
  field: JsonField,
  patch: Record<string, unknown>,
): Undo {
  const before = cachedItem(queryClient, userId, id)?.[field];
  updateItemEverywhere(queryClient, userId, id, (item) => ({
    ...item,
    [field]: mergeRecord(item[field], patch),
  }));
  return () => {
    if (!before) return;
    const restore = Object.fromEntries(
      Object.keys(patch).map((key) => [key, (before as Record<string, unknown>)[key] ?? null]),
    );
    updateItemEverywhere(queryClient, userId, id, (item) => ({
      ...item,
      [field]: mergeRecord(item[field], restore),
    }));
  };
}

export interface UpdateItemDetailsVariables {
  id: string;
  change: DetailsChange;
}

/** Merges changes into an item's copy details, optimistically. */
export function useUpdateItemDetails() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions(queryClient, context),
    mutationFn: ({ id, change }: UpdateItemDetailsVariables) =>
      updateItemDetails(client, id, change),
    onMutate: async ({ id, change }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      // Merge what will be stored (trimmed, deduplicated, sorted), not the raw input.
      const parsed = detailsPatchSchemaFor(change.category).safeParse(change.changes);
      if (!parsed.success) return () => undefined;
      return mergeOptimistically(queryClient, userId, id, 'details', parsed.data);
    },
  });
}

export interface UpdateOverridesVariables {
  id: string;
  patch: OverridesPatch;
}

/** Merges changes into an item's metadata overrides, optimistically (`null` resets a field). */
export function useUpdateOverrides() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions(queryClient, context),
    mutationFn: ({ id, patch }: UpdateOverridesVariables) => updateOverrides(client, id, patch),
    onMutate: async ({ id, patch }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const parsed = overridesPatchSchema.safeParse(patch);
      if (!parsed.success) return () => undefined;
      return mergeOptimistically(queryClient, userId, id, 'metadataOverrides', parsed.data);
    },
  });
}

export interface ResetOverridesVariables {
  id: string;
  /** The field to reset; all fields when left out. */
  field?: OverridableField;
}

/** "Reset to original" for one field or the whole item, optimistically. */
export function useResetOverrides() {
  const context = useCollectionContext();
  const { client, userId } = context;
  const queryClient = useQueryClient();

  return useMutation({
    ...mutationOptions(queryClient, context),
    mutationFn: ({ id, field }: ResetOverridesVariables) =>
      field ? resetOverride(client, id, field) : resetAllOverrides(client, id),
    onMutate: async ({ id, field }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const current = cachedItem(queryClient, userId, id)?.metadataOverrides ?? {};
      const fields = field ? [field] : Object.keys(current);
      const patch = Object.fromEntries(fields.map((key) => [key, null]));
      return mergeOptimistically(queryClient, userId, id, 'metadataOverrides', patch);
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

  const assignMany = useMutation({
    ...options,
    mutationFn: ({ itemIds, tagId }: BulkTagLinkVariables) =>
      bulkAssignTag(
        client,
        itemIds.filter((id) => !isOptimisticId(id)),
        tagId,
      ),
    onMutate: async ({ itemIds, tagId }): Promise<Undo> => {
      await cancelRefetches(queryClient, userId);
      const added = itemIds.filter(
        (id) => !isOptimisticId(id) && !cachedItem(queryClient, userId, id)?.tagIds.includes(tagId),
      );
      for (const id of added) setTagIds(id, add(tagId));
      return () => {
        for (const id of added) setTagIds(id, drop(tagId));
      };
    },
  });

  return { assign, unassign, assignMany };
}

export interface BulkTagLinkVariables {
  itemIds: readonly string[];
  tagId: string;
}
