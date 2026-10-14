import type { CustomCollection } from '@fanste/core';
import type { Route } from 'next';

// What the custom collection screens (FC-13) show, as plain functions.

/** The page of a collection. */
export function collectionHref(id: string): Route {
  return `/collections/${id}` as Route;
}

/** `1 item`, `12 items`. */
export function itemCountText(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`;
}

/** The confirm text of deleting a collection; `count` is `undefined` while it loads. */
export function deleteCollectionText(count: number | undefined): string {
  if (count === undefined) return 'Its items are deleted with it. This cannot be undone.';
  if (count === 0) return 'It has no items. This cannot be undone.';
  return `Its ${itemCountText(count)} ${count === 1 ? 'is' : 'are'} deleted with it. This cannot be undone.`;
}

/**
 * The order after dragging `activeId` onto `overId`'s place, as collection IDs; the same order when
 * either is unknown or they are the same.
 */
export function movedOrder(
  collections: readonly Pick<CustomCollection, 'id'>[],
  activeId: string,
  overId: string,
): string[] {
  const ids = collections.map((collection) => collection.id);
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids;
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved as string);
  return ids;
}
