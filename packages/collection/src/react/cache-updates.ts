import { collectionQuerySchema, updateItemPatchSchema } from '@fanste/core';

import type { CopiesByRef, ItemCopy } from '../repository/copies';
import type { CollectionPage } from '../repository/items';
import type { CollectionItem, CollectionQuery, UpdateItemPatch } from '@fanste/core';

// Pure helpers for optimistic updates: each returns a new cache value and never mutates its input.
// After the mutation settles the queries are refetched, so these only have to be close enough.

/** The title the user sees: their override, else the provider's. */
function displayTitle(item: CollectionItem): string {
  return item.metadataOverrides.title ?? item.metadata?.title ?? '';
}

/** The subtitle the user sees: their override, else the provider's. */
function displaySubtitle(item: CollectionItem): string {
  return item.metadataOverrides.subtitle ?? item.metadata?.subtitle ?? '';
}

/** Whether a filter is off, or `value` is one of its selected values. */
function selects<T>(selected: readonly T[] | undefined, value: T): boolean {
  return !selected || selected.length === 0 || selected.includes(value);
}

/** Whether a copy-details filter is off, or the item's show-level field has a selected value. */
function selectsDetail(selected: readonly string[] | undefined, value: unknown): boolean {
  if (!selected || selected.length === 0) return true;
  const values = Array.isArray(value) ? value : [value];
  return values.some((entry) => typeof entry === 'string' && selected.includes(entry));
}

/**
 * Whether `item` belongs in the results of `query` (filters only, not the page). Close to
 * `collection_item_matches` in the database, which decides after the refetch; TV seasons are left
 * out here.
 */
export function matchesQuery(item: CollectionItem, query: CollectionQuery): boolean {
  const filter = collectionQuerySchema.parse(query);
  if (filter.category && item.category !== filter.category) return false;
  if (!selects(filter.ownership, item.ownership)) return false;
  if (!selects(filter.sources, item.source)) return false;
  if (filter.formats?.length && !(item.format && filter.formats.includes(item.format))) {
    return false;
  }
  if (filter.tagIds?.length && !filter.tagIds.some((id) => item.tagIds.includes(id))) return false;
  if (filter.acquiredFrom && !(item.acquiredAt && item.acquiredAt >= filter.acquiredFrom)) {
    return false;
  }
  if (filter.acquiredTo && !(item.acquiredAt && item.acquiredAt <= filter.acquiredTo)) return false;
  if (filter.search) {
    const search = filter.search.toLowerCase();
    const text = [displayTitle(item), displaySubtitle(item)];
    if (!text.some((entry) => entry.toLowerCase().includes(search))) return false;
  }
  const details = filter.details ?? {};
  return (
    selectsDetail(details.resolution, item.details.resolution) &&
    selectsDetail(details.hdr, item.details.hdr) &&
    selectsDetail(details.edition, item.details.edition) &&
    selectsDetail(details.audioLanguages, item.details.audioLanguages) &&
    selectsDetail(details.subtitleLanguages, item.details.subtitleLanguages)
  );
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

/**
 * Adds a copy to a cached copies lookup. Only lookups that asked for the item (they have an entry
 * for every requested ref) change.
 */
export function addCopy(copies: CopiesByRef, key: string, copy: ItemCopy): CopiesByRef {
  const list = copies[key];
  if (!list || list.some((entry) => entry.id === copy.id)) return copies;
  return { ...copies, [key]: [...list, copy] };
}

/** Removes a copy (e.g. an optimistic one) from a cached copies lookup. */
export function removeCopy(copies: CopiesByRef, key: string, id: string): CopiesByRef {
  const list = copies[key];
  if (!list?.some((entry) => entry.id === id)) return copies;
  return { ...copies, [key]: list.filter((entry) => entry.id !== id) };
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

/**
 * Pages 1…N of a query as one list, for infinite scrolling. Pages are read in order up to the first
 * one not loaded yet. An item that moved to a later page between loads (rows added or removed
 * meanwhile) shows once, where it came first. `hasMore`: the first page's total is larger than what
 * the loaded pages cover.
 */
export function mergePages(pages: readonly (CollectionPage | undefined)[]): {
  items: CollectionItem[];
  hasMore: boolean;
} {
  const seen = new Set<string>();
  const items: CollectionItem[] = [];
  let covered = 0;
  for (const page of pages) {
    if (!page) break;
    covered = (page.page - 1) * page.pageSize + page.items.length;
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  const total = pages[0]?.total;
  return { items, hasMore: total !== undefined && covered < total };
}
