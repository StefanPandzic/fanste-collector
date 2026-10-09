import { z } from 'zod';

import { addItemInputSchema, collectionQuerySchema, updateItemPatchSchema } from '@fanste/core';

import { CollectionError, toCollectionError } from '../errors';
import {
  fromInsertedRow,
  ITEM_VIEW_SELECT,
  toCollectionItem,
  toInsertRow,
  toUpdateRow,
} from './mappers';

import type { ItemViewRow } from './mappers';
import type {
  AddItemInput,
  CollectionItem,
  CollectionQuery,
  CollectionSort,
  ItemRef,
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
};

/** Ids per delete request, so the `in.(...)` filter stays well within URL limits. */
const DELETE_CHUNK = 100;
// PostgREST answers a range past the last row with this code.
const RANGE_NOT_SATISFIABLE = 'PGRST103';

/**
 * Escapes `%`, `_` and `\`, so user input matches literally in `ilike`. PostgREST turns every `*` into
 * `%` and has no escape for it, so `*` becomes `_` (any one character, the asterisk included).
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`).replaceAll('*', '_');
}

/**
 * A page of the user's collection from `collection_items_view` (RLS limits it to their rows).
 * `search` matches the displayed title; `tagIds` matches items with any of the tags.
 */
export async function listItems(
  client: FansteSupabaseClient,
  query: CollectionQuery = {},
): Promise<CollectionPage> {
  const { category, ownership, tagIds, search, sort, page, pageSize } =
    collectionQuerySchema.parse(query);
  const filterByTags = tagIds !== undefined && tagIds.length > 0;

  function build(head: boolean) {
    // A second, inner-joined embed filters by tag without trimming the item's own tag list.
    const select = filterByTags
      ? `${ITEM_VIEW_SELECT}, tag_filter:collection_item_tags!inner(tag_id)`
      : ITEM_VIEW_SELECT;
    let request = client.from('collection_items_view').select(select, { count: 'exact', head });
    if (category) request = request.eq('category', category);
    if (ownership && ownership.length > 0) request = request.in('ownership', ownership);
    if (search) request = request.ilike('title', `%${escapeLike(search)}%`);
    if (filterByTags) request = request.in('tag_filter.tag_id', tagIds);
    return request;
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

/** Deletes many items; returns how many were deleted. Unknown ids are skipped. */
export async function bulkDelete(
  client: FansteSupabaseClient,
  ids: readonly string[],
): Promise<number> {
  const valid = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
  let deleted = 0;
  for (let start = 0; start < valid.length; start += DELETE_CHUNK) {
    const { data, error } = await client
      .from('collection_items')
      .delete()
      .in('id', valid.slice(start, start + DELETE_CHUNK))
      .select('id');
    if (error) throw toCollectionError(error);
    deleted += data.length;
  }
  return deleted;
}
