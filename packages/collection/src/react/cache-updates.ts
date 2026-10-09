import { collectionQuerySchema, updateItemPatchSchema } from '@fanste/core';

import type { CollectionPage } from '../repository/items';
import type { CollectionItem, CollectionQuery, UpdateItemPatch } from '@fanste/core';

// Pure helpers for optimistic updates: each returns a new cache value and never mutates its input.
// After the mutation settles the queries are refetched, so these only have to be close enough.

/** The title the user sees: their override, else the provider's. */
function displayTitle(item: CollectionItem): string {
  return item.metadataOverrides.title ?? item.metadata?.title ?? '';
}

/** Whether `item` belongs in the results of `query` (filters only, not the page). */
export function matchesQuery(item: CollectionItem, query: CollectionQuery): boolean {
  const { category, ownership, tagIds, search } = collectionQuerySchema.parse(query);
  if (category && item.category !== category) return false;
  if (ownership && ownership.length > 0 && !ownership.includes(item.ownership)) return false;
  if (tagIds && tagIds.length > 0 && !tagIds.some((id) => item.tagIds.includes(id))) return false;
  if (search && !displayTitle(item).toLowerCase().includes(search.toLowerCase())) return false;
  return true;
}

/**
 * Adds a new item to a cached page. It goes to the top of the first page of a newest-first list;
 * in any other list only the total changes, because its position isn't known until the refetch.
 */
export function addToPage(
  page: CollectionPage,
  item: CollectionItem,
  query: CollectionQuery,
): CollectionPage {
  if (!matchesQuery(item, query)) return page;
  // Already there, e.g. a refetch that ran while the add was in flight.
  if (page.items.some((entry) => entry.id === item.id)) return page;
  const { sort } = collectionQuerySchema.parse(query);
  if (page.page !== 1 || sort !== 'added_desc') return { ...page, total: page.total + 1 };
  return {
    ...page,
    items: [item, ...page.items].slice(0, page.pageSize),
    total: page.total + 1,
  };
}

/** Applies a patch to an item. An invalid patch leaves it unchanged (the server will reject it). */
export function applyPatch(item: CollectionItem, patch: UpdateItemPatch): CollectionItem {
  const parsed = updateItemPatchSchema.safeParse(patch);
  if (!parsed.success) return item;
  const changes = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  );
  return { ...item, ...changes };
}

/**
 * A jsonb merge like `merge_item_details` / `merge_item_overrides` do it: present keys are set,
 * `null` keys removed, the rest kept.
 */
export function mergeRecord<T extends object>(record: T, patch: Record<string, unknown>): T {
  const merged: Record<string, unknown> = { ...(record as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete merged[key];
    else if (value !== undefined) merged[key] = value;
  }
  return merged as T;
}

/** Replaces the item with `id` in a page using `update`. */
export function updateInPage(
  page: CollectionPage,
  id: string,
  update: (item: CollectionItem) => CollectionItem,
): CollectionPage {
  if (!page.items.some((item) => item.id === id)) return page;
  return { ...page, items: page.items.map((item) => (item.id === id ? update(item) : item)) };
}

/** Removes items from a page and lowers the total by the number removed. */
export function removeFromPage(page: CollectionPage, ids: ReadonlySet<string>): CollectionPage {
  const items = page.items.filter((item) => !ids.has(item.id));
  const removed = page.items.length - items.length;
  if (removed === 0) return page;
  return { ...page, items, total: Math.max(0, page.total - removed) };
}

/** Prefix of the temporary IDs given to optimistically added items. */
export const OPTIMISTIC_ID_PREFIX = 'optimistic-';

/** Whether `id` belongs to an item that is still being added (it has no database row yet). */
export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

/**
 * Undoes an `addToPage` that changed this page: removes the optimistic item, or, where only the
 * total was raised, lowers it again.
 */
export function undoAddToPage(page: CollectionPage, optimisticId: string): CollectionPage {
  if (page.items.some((item) => item.id === optimisticId)) {
    return removeFromPage(page, new Set([optimisticId]));
  }
  return { ...page, total: Math.max(0, page.total - 1) };
}

/** Puts a removed item back at `index` (undoing a delete), unless it is already there. */
export function restoreToPage(
  page: CollectionPage,
  item: CollectionItem,
  index: number,
): CollectionPage {
  if (page.items.some((entry) => entry.id === item.id)) return page;
  const items = [...page.items];
  items.splice(Math.min(index, items.length), 0, item);
  return { ...page, items, total: page.total + 1 };
}
