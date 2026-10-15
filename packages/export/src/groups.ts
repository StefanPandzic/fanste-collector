import { categoryLabel, ITEM_CATEGORIES } from '@fanste/core';

import type {
  CollectionFilter,
  CollectionItem,
  CustomCollection,
  ItemCategory,
} from '@fanste/core';

// What an export can be split into (FC-25): one group per category, and one per custom collection.

/** A category, or `custom:<collection id>` for one custom collection. */
export type ExportGroupKey = Exclude<ItemCategory, 'custom'> | `custom:${string}`;

export interface ExportTarget {
  key: ExportGroupKey;
  label: string;
  /** Items in the export's scope. */
  count: number;
}

export interface ExportGroup {
  key: ExportGroupKey;
  label: string;
  items: CollectionItem[];
}

/** Items of a custom collection that's gone (shouldn't happen) go in this group. */
const UNKNOWN_COLLECTION = 'custom:';

export function groupKeyOf(item: Pick<CollectionItem, 'category' | 'customCollectionId'>) {
  return item.category === 'custom'
    ? (`custom:${item.customCollectionId ?? ''}` as const)
    : item.category;
}

function collectionOf(key: ExportGroupKey): string | undefined {
  return key.startsWith('custom:') ? key.slice('custom:'.length) : undefined;
}

/** Collections in the user's order. */
function sortedCollections(collections: readonly CustomCollection[]): CustomCollection[] {
  return collections.toSorted((a, b) => a.sortOrder - b.sortOrder);
}

function groupLabel(key: ExportGroupKey, collections: readonly CustomCollection[]): string {
  const collectionId = collectionOf(key);
  if (collectionId === undefined) return categoryLabel(key as ItemCategory, { plural: true });
  return collections.find((collection) => collection.id === collectionId)?.name ?? 'Custom';
}

/** Every group in the app's order (custom collections in the user's order), with its label. */
function allGroups(
  collections: readonly CustomCollection[],
): { key: ExportGroupKey; label: string }[] {
  return ITEM_CATEGORIES.flatMap<{ key: ExportGroupKey; label: string }>((category) =>
    category === 'custom'
      ? sortedCollections(collections).map((collection) => ({
          key: `custom:${collection.id}` as const,
          label: collection.name,
        }))
      : [{ key: category, label: categoryLabel(category, { plural: true }) }],
  );
}

/** Whether a group is inside the scope's category and custom collection filters. */
function inScope(key: ExportGroupKey, base: CollectionFilter): boolean {
  const collectionId = collectionOf(key);
  const category = collectionId === undefined ? key : 'custom';
  if (base.category !== undefined && base.category !== category) return false;
  if (collectionId !== undefined && base.customCollectionIds?.length) {
    return base.customCollectionIds.includes(collectionId);
  }
  return true;
}

/**
 * The groups the user can pick for the items matching `base`, with their counts from the gallery's
 * facets of `base` (`category` and `customCollection`). A facet counts every value but its own
 * filter's, so groups outside `base`'s category and collections are left out here, like groups
 * without items.
 */
export function exportTargets(
  counts: { category: Record<string, number>; customCollection: Record<string, number> },
  collections: readonly CustomCollection[],
  base: CollectionFilter = {},
): ExportTarget[] {
  return allGroups(collections).flatMap(({ key, label }) => {
    const collectionId = collectionOf(key);
    const count =
      (collectionId === undefined ? counts.category[key] : counts.customCollection[collectionId]) ??
      0;
    return count > 0 && inScope(key, base) ? [{ key, label, count }] : [];
  });
}

/** The groups of some items (e.g. the gallery's selection), with how many of them each has. */
export function targetsOfItems(
  items: readonly Pick<CollectionItem, 'category' | 'customCollectionId'>[],
  collections: readonly CustomCollection[],
): ExportTarget[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = groupKeyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return allGroups(collections).flatMap(({ key, label }) => {
    const count = counts.get(key) ?? 0;
    return count > 0 ? [{ key, label, count }] : [];
  });
}

/**
 * The queries that load the picked groups within `base` (the export's scope): one per category, and
 * one for all picked custom collections.
 */
export function targetFilters(
  base: CollectionFilter,
  keys: readonly ExportGroupKey[],
): CollectionFilter[] {
  const filters: CollectionFilter[] = [];
  const collectionIds: string[] = [];
  for (const key of keys) {
    const collectionId = collectionOf(key);
    if (collectionId === undefined) filters.push({ ...base, category: key as ItemCategory });
    else collectionIds.push(collectionId);
  }
  if (collectionIds.length > 0) {
    filters.push({ ...base, category: 'custom', customCollectionIds: collectionIds });
  }
  return filters;
}

/** Splits items into their groups, in the app's order (custom collections in the user's order). */
export function groupForExport(
  items: readonly CollectionItem[],
  collections: readonly CustomCollection[],
): ExportGroup[] {
  const byKey = new Map<ExportGroupKey, CollectionItem[]>();
  for (const item of items) {
    const key = groupKeyOf(item);
    const list = byKey.get(key);
    if (list) list.push(item);
    else byKey.set(key, [item]);
  }
  const order: ExportGroupKey[] = [
    ...ITEM_CATEGORIES.filter((category) => category !== 'custom'),
    ...sortedCollections(collections).map((collection) => `custom:${collection.id}` as const),
    UNKNOWN_COLLECTION,
  ];
  const position = (key: ExportGroupKey) => {
    const index = order.indexOf(key);
    // A collection missing from the list sorts with the unknown group.
    return index === -1 ? order.length - 1 : index;
  };
  return [...byKey.entries()]
    .sort(([a], [b]) => position(a) - position(b))
    .map(([key, list]) => ({ key, label: groupLabel(key, collections), items: list }));
}
