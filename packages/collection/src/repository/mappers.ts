import {
  COPY_DETAIL_STATUSES,
  fromMetadataCacheRow,
  ITEM_CATEGORIES,
  OWNERSHIP_STATUSES,
  parseOverrides,
} from '@fanste/core';

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
    metadataOverrides: parseOverrides(row.metadata_overrides),
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
    details: (input.details ?? {}) as Json,
    source: input.source ?? 'manual',
    ...toUpdateRow(input),
  };
}

/**
 * The `collection_items` insert that puts a deleted copy back as it was (undo of a delete): the same
 * ID, copy fields, details, overrides and `created_at`. Custom items also need their `custom_data`,
 * which `CollectionItem` doesn't carry yet (FC-13).
 */
export function toRestoreRow(item: CollectionItem): TablesInsert<'collection_items'> {
  return {
    id: item.id,
    category: item.category,
    provider: item.provider,
    external_id: item.externalId,
    format: item.format,
    details: item.details as Json,
    metadata_overrides: item.metadataOverrides,
    ownership: item.ownership,
    quantity: item.quantity,
    acquired_at: item.acquiredAt,
    purchase_price: item.purchasePrice,
    estimated_value: item.estimatedValue,
    currency: item.currency,
    notes: item.notes,
    source: item.source,
    created_at: item.createdAt,
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
 * for), the same statuses that carry copy details. Wishlist and sold items are left out.
 */
export const VALUED_STATUSES: readonly OwnershipStatus[] = COPY_DETAIL_STATUSES;

/** Copies added in one calendar month. */
export interface MonthCount {
  /** `YYYY-MM`, in the time zone the stats were asked for. */
  month: string;
  items: number;
}

/** How many months `addedByMonth` covers, this month included. Matches `collection_stats()`. */
export const ADDED_BY_MONTH_SPAN = 12;

export interface CollectionStats {
  /** Every copy, whatever its status. */
  totals: ItemCounts;
  byCategory: Record<ItemCategory, ItemCounts>;
  byOwnership: Record<OwnershipStatus, ItemCounts>;
  /** The copies the user has (`VALUED_STATUSES`); wishlist and sold items are left out. */
  inCollection: ItemCounts;
  inCollectionByCategory: Record<ItemCategory, ItemCounts>;
  /** Per currency, largest first. Only `VALUED_STATUSES` count. */
  estimatedValue: ValueTotal[];
  /** `estimatedValue` split by category. */
  valueByCategory: Record<ItemCategory, ValueTotal[]>;
  /**
   * Copies the user has, by the month they were added: the last `ADDED_BY_MONTH_SPAN` months,
   * oldest first, months without additions included.
   */
  addedByMonth: MonthCount[];
}

/**
 * A row of `collection_stats()`. The generated types call `currency` and `added_month` non-null,
 * but they are null for items without a currency and for items added before the charted months.
 */
export interface StatsRow {
  category: ItemCategory;
  ownership: OwnershipStatus;
  currency: string | null;
  /** First day of the month the item was added (`YYYY-MM-DD`). */
  added_month: string | null;
  item_count: number;
  quantity_total: number;
  estimated_value_total: number;
}

/** Where `addedByMonth` ends, and the time zone (an IANA name) its months are in. */
export interface StatsClock {
  now: Date;
  timeZone: string;
}

/** The `YYYY-MM` keys of the `count` months up to the one `now` is in, oldest first. */
export function recentMonths({ now, timeZone }: StatsClock, count: number): string[] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, month - count + index, 1)).toISOString().slice(0, 7),
  );
}

function perCategory<T>(make: () => T): Record<ItemCategory, T> {
  return Object.fromEntries(ITEM_CATEGORIES.map((key) => [key, make()])) as Record<ItemCategory, T>;
}

function addValue(values: Map<string | null, number>, currency: string | null, value: number) {
  values.set(currency, (values.get(currency) ?? 0) + value);
}

/** Largest first, rounded to cents. */
function toValueTotals(values: Map<string | null, number>): ValueTotal[] {
  return [...values]
    .map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}

/** Folds the rows of `collection_stats()` into totals per category, status, currency and month. */
export function toCollectionStats(rows: readonly StatsRow[], clock: StatsClock): CollectionStats {
  const empty = (): ItemCounts => ({ items: 0, quantity: 0 });
  const stats: CollectionStats = {
    totals: empty(),
    byCategory: perCategory(empty),
    byOwnership: Object.fromEntries(OWNERSHIP_STATUSES.map((key) => [key, empty()])) as Record<
      OwnershipStatus,
      ItemCounts
    >,
    inCollection: empty(),
    inCollectionByCategory: perCategory(empty),
    estimatedValue: [],
    valueByCategory: perCategory(() => []),
    addedByMonth: [],
  };
  const values = new Map<string | null, number>();
  const categoryValues = perCategory(() => new Map<string | null, number>());
  const months = new Map(recentMonths(clock, ADDED_BY_MONTH_SPAN).map((month) => [month, 0]));

  for (const row of rows) {
    const items = Number(row.item_count);
    const quantity = Number(row.quantity_total);
    const held = VALUED_STATUSES.includes(row.ownership);
    const counted = [
      stats.totals,
      stats.byCategory[row.category],
      stats.byOwnership[row.ownership],
    ];
    if (held) counted.push(stats.inCollection, stats.inCollectionByCategory[row.category]);
    for (const counts of counted) {
      counts.items += items;
      counts.quantity += quantity;
    }
    if (!held) continue;

    const value = Number(row.estimated_value_total);
    if (value > 0) {
      addValue(values, row.currency, value);
      addValue(categoryValues[row.category], row.currency, value);
    }
    // Rows of a month outside the window (the database's clock is a little ahead) are skipped.
    const month = row.added_month?.slice(0, 7);
    if (month !== undefined && months.has(month)) {
      months.set(month, (months.get(month) ?? 0) + items);
    }
  }

  stats.estimatedValue = toValueTotals(values);
  for (const category of ITEM_CATEGORIES) {
    stats.valueByCategory[category] = toValueTotals(categoryValues[category]);
  }
  stats.addedByMonth = [...months].map(([month, items]) => ({ month, items }));
  return stats;
}
