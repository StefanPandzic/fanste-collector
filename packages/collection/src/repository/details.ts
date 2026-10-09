import {
  copyDefaultsSchema,
  detailsPatchSchemaFor,
  OVERRIDABLE_FIELDS,
  overridesPatchSchema,
  parsePreferences,
} from '@fanste/core';

import { CollectionError, toCollectionError } from '../errors';
import { getItem } from './items';

import type {
  CollectionItem,
  CopyDefaults,
  DetailsPatch,
  ItemCategory,
  Json,
  OverridableField,
  OverridesPatch,
  UserPreferences,
} from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

// Editing a copy's details and metadata overrides (FC-15). Both are jsonb columns, merged in the
// database (`merge_item_details`, `merge_item_overrides`), so two devices editing different fields of
// one item don't overwrite each other.

/**
 * Changes to an item's `details`. The category picks the schema the changes are checked against, and
 * must be the item's own: the merge skips an item of another category (`not_found`).
 */
export interface CategoryDetailsChange<C extends ItemCategory> {
  category: C;
  /** Present fields are set, `null` fields removed, others kept. Arrays are replaced as a whole. */
  changes: DetailsPatch<C>;
}

/** A `CategoryDetailsChange` of any category, with `changes` typed by its `category`. */
export type DetailsChange = { [C in ItemCategory]: CategoryDetailsChange<C> }[ItemCategory];

/** The item as stored, after a change to it. */
async function reload(client: FansteSupabaseClient, id: string): Promise<CollectionItem> {
  const item = await getItem(client, id);
  if (!item) throw new CollectionError('not_found', `No item ${id}.`);
  return item;
}

/** Fails with `not_found` when a merge function matched no row. */
function checkMerged({ data, error }: { data: string[] | null; error: unknown }, id: string): void {
  if (error) throw toCollectionError(error);
  if (!data || data.length === 0) throw new CollectionError('not_found', `No item ${id}.`);
}

function parse<T>(parseFn: () => T): T {
  try {
    return parseFn();
  } catch (error) {
    throw toCollectionError(error);
  }
}

/** Merges changes into an item's copy details and returns the item as stored. */
export async function updateItemDetails(
  client: FansteSupabaseClient,
  id: string,
  { category, changes }: DetailsChange,
): Promise<CollectionItem> {
  const patch: Record<string, unknown> = parse(() =>
    detailsPatchSchemaFor(category).parse(changes),
  );
  if (Object.keys(patch).length > 0) {
    checkMerged(
      await client.rpc('merge_item_details', {
        p_id: id,
        p_category: category,
        p_patch: patch as Json,
      }),
      id,
    );
  }
  return reload(client, id);
}

async function mergeOverrides(
  client: FansteSupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<CollectionItem> {
  if (Object.keys(patch).length > 0) {
    checkMerged(await client.rpc('merge_item_overrides', { p_id: id, p_patch: patch as Json }), id);
  }
  return reload(client, id);
}

/**
 * Merges changes into an item's metadata overrides (`null` resets a field to the provider's value)
 * and returns the item as stored.
 */
export async function updateOverrides(
  client: FansteSupabaseClient,
  id: string,
  patch: OverridesPatch,
): Promise<CollectionItem> {
  return mergeOverrides(
    client,
    id,
    parse(() => overridesPatchSchema.parse(patch)),
  );
}

/** "Reset to original" for one field. */
export function resetOverride(
  client: FansteSupabaseClient,
  id: string,
  field: OverridableField,
): Promise<CollectionItem> {
  return updateOverrides(client, id, { [field]: null });
}

/**
 * "Reset to original" for every field: a merge that removes each overridable field, so it's atomic
 * like the other edits. Keys no schema knows are left; `parseOverrides` ignores them.
 */
export function resetAllOverrides(
  client: FansteSupabaseClient,
  id: string,
): Promise<CollectionItem> {
  return mergeOverrides(
    client,
    id,
    Object.fromEntries(OVERRIDABLE_FIELDS.map((field) => [field, null])),
  );
}

/** The user's last-used medium and detail habits per category (`profiles.preferences`). */
export async function getCopyDefaults(
  client: FansteSupabaseClient,
): Promise<UserPreferences['copyDefaults']> {
  // RLS limits `profiles` to the caller's own row.
  const { data, error } = await client.from('profiles').select('preferences').maybeSingle();
  if (error) throw toCollectionError(error);
  return parsePreferences(data?.preferences).copyDefaults;
}

/** Stores the last-used values of a category; build them with `copyDefaultsFrom`. */
export async function saveCopyDefaults(
  client: FansteSupabaseClient,
  category: ItemCategory,
  defaults: CopyDefaults,
): Promise<void> {
  const parsed = parse(() => copyDefaultsSchema.parse(defaults));
  const { error } = await client.rpc('set_copy_defaults', {
    p_category: category,
    p_defaults: parsed as Json,
  });
  if (error) throw toCollectionError(error);
}
