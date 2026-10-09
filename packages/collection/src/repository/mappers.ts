import { fromMetadataCacheRow, ITEM_CATEGORIES, OWNERSHIP_STATUSES } from '@fanste/core';

import type {
  addItemInputSchema,
  CollectionItem,
  ItemCategory,
  ItemSource,
  Json,
  NormalizedItem,
  OwnershipStatus,
  Tag,
  updateItemPatchSchema,
} from '@fanste/core';
import type { Tables, TablesInsert, TablesUpdate } from '@fanste/supabase';
import type { z } from 'zod';

/** A `collection_items_view` row with its tag links, as `listItems` / `getItem` select it. */
export type ItemViewRow = Tables<'collection_items_view'> & {
  collection_item_tags?: { tag_id: string }[] | null;
};

/** Columns read from `collection_items_view`, plus the item's tag IDs. */
export const ITEM_VIEW_SELECT = '*, collection_item_tags(tag_id)';

/**
 * Converts a view row into a `CollectionItem`. The view types every column as nullable; the
 * underlying table guarantees the identity and copy columns, so missing ones only default.
 */
export function toCollectionItem(row: ItemViewRow): CollectionItem {
  return {
    id: row.id ?? '',
    userId: row.user_id ?? '',
    category: row.category ?? 'movie',
    provider: row.provider ?? 'custom',
    externalId: row.external_id,
    format: row.format,
    details: asRecord(row.details),
    metadataOverrides: asRecord(row.metadata_overrides),
    ownership: row.ownership ?? 'owned',
    quantity: row.quantity ?? 1,
    acquiredAt: row.acquired_at,
    purchasePrice: row.purchase_price,
    estimatedValue: row.estimated_value,
    currency: row.currency,
    notes: row.notes,
    source: (row.source ?? 'manual') as ItemSource,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
    tagIds: (row.collection_item_tags ?? []).map((link) => link.tag_id),
    metadata: providerMetadata(row),
  };
}

/** The cached provider metadata of a row (without overrides), or `null` if it isn't cached yet. */
function providerMetadata(row: ItemViewRow): NormalizedItem | null {
  // Custom items keep their data in `custom_data`; normalizing it on read is FC-13.
  if (row.provider === 'custom' || row.provider === null) return null;
  if (row.metadata_fetched_at === null || row.provider_title === null) return null;
  if (row.external_id === null || row.category === null) return null;
  return fromMetadataCacheRow({
    provider: row.provider,
    external_id: row.external_id,
    category: row.category,
    title: row.provider_title,
    subtitle: row.provider_subtitle,
    release_year: row.provider_release_year,
    image_url: row.provider_image_url,
    payload: row.metadata_payload,
  });
}

function asRecord(value: Json | null): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

type ParsedAddItem = z.output<typeof addItemInputSchema>;
type ParsedPatch = z.output<typeof updateItemPatchSchema>;

/**
 * The `collection_items` insert for a parsed `AddItemInput`. `user_id` comes from the column default
 * (`auth.uid()`), and `format_key` is generated, so neither is sent.
 */
export function toInsertRow(input: ParsedAddItem): TablesInsert<'collection_items'> {
  return {
    category: input.category,
    provider: input.provider,
    external_id: input.externalId,
    // Prefilling `format` / `details` from the provider (`prefillDetails`) is FC-15; until then
    // they are whatever the caller passes.
    details: (input.details ?? {}) as Json,
    source: input.source ?? 'manual',
    ...toUpdateRow(input),
  };
}

/** The `collection_items` update for a parsed patch. Only the fields present are sent. */
export function toUpdateRow(patch: ParsedPatch): TablesUpdate<'collection_items'> {
  const row: TablesUpdate<'collection_items'> = {};
  if (patch.format !== undefined) row.format = patch.format;
  if (patch.ownership !== undefined) row.ownership = patch.ownership;
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.acquiredAt !== undefined) row.acquired_at = patch.acquiredAt;
  if (patch.purchasePrice !== undefined) row.purchase_price = patch.purchasePrice;
  if (patch.estimatedValue !== undefined) row.estimated_value = patch.estimatedValue;
  if (patch.currency !== undefined) row.currency = patch.currency;
  if (patch.notes !== undefined) row.notes = patch.notes;
  return row;
}

/**
 * A `collection_items` row returned by an insert, plus the metadata the caller already has. Used for
 * the result of `addItem`, so it needs no second query.
 */
export function fromInsertedRow(
  row: Tables<'collection_items'>,
  metadata: NormalizedItem | null,
): CollectionItem {
  const item = toCollectionItem({
    ...row,
    title: null,
    subtitle: null,
    release_year: null,
    image_url: null,
    provider_title: null,
    provider_subtitle: null,
    provider_release_year: null,
    provider_image_url: null,
    metadata_fetched_at: null,
    metadata_payload: null,
    collection_item_tags: [],
  });
  return { ...item, metadata };
}

export function toTag(row: Tables<'tags'>): Tag {
  return { id: row.id, name: row.name, color: row.color };
}

/** Counts of copies and units. */
export interface ItemCounts {
  /** Rows (copies). */
  items: number;
  /** Sum of the copies' quantities. */
  quantity: number;
}

/** Estimated value of the collection in one currency (`null`: items without a currency). */
export interface ValueTotal {
  currency: string | null;
  total: number;
}

/**
 * Statuses whose items count towards the collection's value: the copies the user has (or has paid
 * for). Wishlist and sold items are left out.
 */
export const VALUED_STATUSES: readonly OwnershipStatus[] = ['owned', 'loaned_out', 'preordered'];

export interface CollectionStats {
  totals: ItemCounts;
  byCategory: Record<ItemCategory, ItemCounts>;
  byOwnership: Record<OwnershipStatus, ItemCounts>;
  /** Per currency, largest first. Only `VALUED_STATUSES` count. */
  estimatedValue: ValueTotal[];
}

/**
 * A row of `collection_stats()`. The generated types call `currency` non-null, but it is null for
 * items without a currency.
 */
export interface StatsRow {
  category: ItemCategory;
  ownership: OwnershipStatus;
  currency: string | null;
  item_count: number;
  quantity_total: number;
  estimated_value_total: number;
}

/** Folds the rows of `collection_stats()` into totals per category, status and currency. */
export function toCollectionStats(rows: readonly StatsRow[]): CollectionStats {
  const empty = (): ItemCounts => ({ items: 0, quantity: 0 });
  const stats: CollectionStats = {
    totals: empty(),
    byCategory: Object.fromEntries(ITEM_CATEGORIES.map((key) => [key, empty()])) as Record<
      ItemCategory,
      ItemCounts
    >,
    byOwnership: Object.fromEntries(OWNERSHIP_STATUSES.map((key) => [key, empty()])) as Record<
      OwnershipStatus,
      ItemCounts
    >,
    estimatedValue: [],
  };
  const values = new Map<string | null, number>();

  for (const row of rows) {
    const items = Number(row.item_count);
    const quantity = Number(row.quantity_total);
    for (const counts of [
      stats.totals,
      stats.byCategory[row.category],
      stats.byOwnership[row.ownership],
    ]) {
      counts.items += items;
      counts.quantity += quantity;
    }
    const value = Number(row.estimated_value_total);
    if (VALUED_STATUSES.includes(row.ownership) && value > 0) {
      values.set(row.currency, (values.get(row.currency) ?? 0) + value);
    }
  }

  stats.estimatedValue = [...values]
    .map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
  return stats;
}
