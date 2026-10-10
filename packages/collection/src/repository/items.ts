import { z } from 'zod';

import { addItemInputSchema, collectionQuerySchema, updateItemPatchSchema } from '@fanste/core';

import { CollectionError, toCollectionError } from '../errors';
import {
  fromInsertedRow,
  ITEM_VIEW_SELECT,
  toCollectionItem,
  toInsertRow,
  toRestoreRow,
  toUpdateRow,
} from './mappers';

import type { ItemViewRow } from './mappers';
import type {
  AddItemInput,
  CollectionItem,
  CollectionQuery,
  CollectionSort,
  ItemRef,
  Json,
  NormalizedItem,
  UpdateItemPatch,
} from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

/** One page of the collection. */
export interface CollectionPage {
  items: CollectionItem[];
  /** All items matching the filters. */
  total: number;
  page: number;
  pageSize: number;
}

const SORT_COLUMNS: Record<CollectionSort, { column: string; ascending: boolean }> = {
  added_desc: { column: 'created_at', ascending: false },
  added_asc: { column: 'created_at', ascending: true },
  title_asc: { column: 'title', ascending: true },
  title_desc: { column: 'title', ascending: false },
  year_desc: { column: 'release_year', ascending: false },
  year_asc: { column: 'release_year', ascending: true },
  acquired_desc: { column: 'acquired_at', ascending: false },
  acquired_asc: { column: 'acquired_at', ascending: true },
  value_desc: { column: 'estimated_value', ascending: false },
  value_asc: { column: 'estimated_value', ascending: true },
};

/** Ids per write request, so the `in.(...)` filter stays well within URL limits. */
const WRITE_CHUNK = 100;
// PostgREST answers a range past the last row with this code.
const RANGE_NOT_SATISFIABLE = 'PGRST103';

/**
 * The filter part of a query as the `collection_items_filtered` / `collection_facets` RPCs read it:
 * sort and paging removed, and filters that are off (unset or empty) left out.
 */
export function toFilterJson(query: CollectionQuery): Json {
  const {
    sort: _sort,
    page: _page,
    pageSize: _pageSize,
    details,
    ...filters
  } = collectionQuerySchema.parse(query);
  const json: Record<string, Json> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (isActive(value)) json[key] = value;
  }
  const detailFilters: Record<string, Json> = {};
  for (const [key, value] of Object.entries(details ?? {})) {
    if (isActive(value)) detailFilters[key] = value;
  }
  if (Object.keys(detailFilters).length > 0) json.details = detailFilters;
  return json;
}

function isActive(value: unknown): value is Json {
  if (value === undefined || value === '') return false;
  return !Array.isArray(value) || value.length > 0;
}

/**
 * A page of the user's collection, filtered in the database by `collection_items_filtered` (RLS
 * limits it to their rows). See `CollectionFilter` for the filters.
 */
export async function listItems(
  client: FansteSupabaseClient,
  query: CollectionQuery = {},
): Promise<CollectionPage> {
  const { sort, page, pageSize } = collectionQuerySchema.parse(query);
  const filter = toFilterJson(query);

  function build(head: boolean) {
    return client
      .rpc('collection_items_filtered', { p_filter: filter }, { count: 'exact', head })
      .select(ITEM_VIEW_SELECT);
  }

  const { column, ascending } = SORT_COLUMNS[sort];
  const from = (page - 1) * pageSize;
  const { data, count, error } = await build(false)
    .order(column, { ascending, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1);

  if (error?.code === RANGE_NOT_SATISFIABLE) {
    // The page is past the end, e.g. after items were deleted elsewhere: return it empty.
    const head = await build(true);
    if (head.error) throw toCollectionError(head.error);
    return { items: [], total: head.count ?? 0, page, pageSize };
  }
  if (error) throw toCollectionError(error);

  const rows = (data ?? []) as unknown as ItemViewRow[];
  return { items: rows.map(toCollectionItem), total: count ?? rows.length, page, pageSize };
}

/** One of the user's items, or `null` if it doesn't exist (or isn't theirs). */
export async function getItem(
  client: FansteSupabaseClient,
  id: string,
): Promise<CollectionItem | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await client
    .from('collection_items_view')
    .select(ITEM_VIEW_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw toCollectionError(error);
  return data ? toCollectionItem(data) : null;
}

export interface AddItemDeps {
  /**
   * Loads the item's metadata through the gateway (`api.getItem`), which also stores it in the
   * shared `metadata_cache`, so the new row shows its title and cover at once.
   */
  getMetadata: (ref: ItemRef) => Promise<NormalizedItem>;
}

/**
 * Adds a copy of a provider item. The metadata is loaded first, so an item the provider doesn't have
 * is never added. Adding the same item in the same format twice fails with `duplicate`.
 */
export async function addItem(
  client: FansteSupabaseClient,
  input: AddItemInput,
  { getMetadata }: AddItemDeps,
): Promise<CollectionItem> {
  try {
    const parsed = addItemInputSchema.parse(input);
    const metadata = await getMetadata({
      provider: parsed.provider,
      externalId: parsed.externalId,
    });
    const { data, error } = await client
      .from('collection_items')
      .insert(toInsertRow(parsed))
      .select()
      .single();
    if (error) throw error;
    return fromInsertedRow(data, metadata);
  } catch (error) {
    throw toCollectionError(error);
  }
}

/** Updates the copy fields of an item and returns it as stored. */
export async function updateItem(
  client: FansteSupabaseClient,
  id: string,
  patch: UpdateItemPatch,
): Promise<CollectionItem> {
  let row;
  try {
    row = toUpdateRow(updateItemPatchSchema.parse(patch));
  } catch (error) {
    throw toCollectionError(error);
  }
  if (Object.keys(row).length > 0) {
    const { data, error } = await client
      .from('collection_items')
      .update(row)
      .eq('id', id)
      .select('id');
    if (error) throw toCollectionError(error);
    if (data.length === 0) throw new CollectionError('not_found', `No item ${id}.`);
  }
  const item = await getItem(client, id);
  if (!item) throw new CollectionError('not_found', `No item ${id}.`);
  return item;
}

/** Deletes one item (its tag links go with it). */
export async function deleteItem(client: FansteSupabaseClient, id: string): Promise<void> {
  const deleted = await bulkDelete(client, [id]);
  if (deleted === 0) throw new CollectionError('not_found', `No item ${id}.`);
}

/**
 * Puts a deleted copy back as it was, with the same ID and the tags that still exist (undo of a
 * delete; the tags are best effort). Fails with `duplicate` when the user added the same item in
 * the same medium meanwhile.
 */
export async function restoreItem(
  client: FansteSupabaseClient,
  item: CollectionItem,
): Promise<CollectionItem> {
  if (item.provider === 'custom') {
    // Restoring needs the item's `custom_data`, which comes with custom items (FC-13).
    throw new CollectionError('invalid', 'Custom items cannot be restored yet.');
  }
  const { error } = await client.from('collection_items').insert(toRestoreRow(item));
  if (error) throw toCollectionError(error);

  // The copy is back at this point, so its tags are put back best effort: failing to re-link them
  // must not report the undo as failed.
  await relinkTags(client, item.id, item.tagIds).catch(() => undefined);

  const restored = await getItem(client, item.id);
  if (!restored) throw new CollectionError('not_found', `No item ${item.id}.`);
  return restored;
}

/** Links the tags among `tagIds` that still exist (RLS limits `tags` to the user's own) to an item. */
async function relinkTags(
  client: FansteSupabaseClient,
  itemId: string,
  tagIds: readonly string[],
): Promise<void> {
  if (tagIds.length === 0) return;
  const { data: tags, error } = await client.from('tags').select('id').in('id', tagIds);
  if (error) throw toCollectionError(error);
  if (tags.length === 0) return;
  const { error: linkError } = await client.from('collection_item_tags').upsert(
    tags.map((tag) => ({ item_id: itemId, tag_id: tag.id })),
    { ignoreDuplicates: true },
  );
  if (linkError) throw toCollectionError(linkError);
}

/** Deletes many items; returns how many were deleted. Unknown ids are skipped. */
export async function bulkDelete(
  client: FansteSupabaseClient,
  ids: readonly string[],
): Promise<number> {
  let deleted = 0;
  for (const chunk of idChunks(ids)) {
    const { data, error } = await client
      .from('collection_items')
      .delete()
      .in('id', chunk)
      .select('id');
    if (error) throw toCollectionError(error);
    deleted += data.length;
  }
  return deleted;
}

/** Unique, well-formed item ids, in chunks of `WRITE_CHUNK`. */
function idChunks(ids: readonly string[]): string[][] {
  const valid = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
  const chunks: string[][] = [];
  for (let start = 0; start < valid.length; start += WRITE_CHUNK) {
    chunks.push(valid.slice(start, start + WRITE_CHUNK));
  }
  return chunks;
}

/**
 * Applies the same copy-field patch to many items, e.g. a bulk ownership change; returns how many
 * were updated. Unknown ids are skipped.
 */
export async function bulkUpdateItems(
  client: FansteSupabaseClient,
  ids: readonly string[],
  patch: UpdateItemPatch,
): Promise<number> {
  let row;
  try {
    row = toUpdateRow(updateItemPatchSchema.parse(patch));
  } catch (error) {
    throw toCollectionError(error);
  }
  if (Object.keys(row).length === 0) return 0;
  let updated = 0;
  for (const chunk of idChunks(ids)) {
    const { data, error } = await client
      .from('collection_items')
      .update(row)
      .in('id', chunk)
      .select('id');
    if (error) throw toCollectionError(error);
    updated += data.length;
  }
  return updated;
}
