import { addCustomItemInputSchema, customItemDataPatchSchema } from '@fanste/core';

import { CollectionError, toCollectionError } from '../errors';
import { getItem } from './items';
import { fromInsertedRow, toUpdateRow } from './mappers';

import type { AddCustomItemInput, CollectionItem, CustomItemDataPatch, Json } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

// Hand-entered items (FC-13): the items of custom collections, and items of an integrated category
// that its provider lacks. Their data is in `custom_data`, so they never call the gateway.

/** Adds a hand-entered item. Its row is the item and its one copy at once. */
export async function addCustomItem(
  client: FansteSupabaseClient,
  input: AddCustomItemInput,
): Promise<CollectionItem> {
  try {
    const parsed = addCustomItemInputSchema.parse(input);
    const { data, error } = await client
      .from('collection_items')
      .insert({
        category: parsed.category,
        provider: 'custom',
        external_id: null,
        custom_collection_id: parsed.customCollectionId ?? null,
        custom_data: parsed.customData as Json,
        details: (parsed.details ?? {}) as Json,
        source: 'manual',
        ...toUpdateRow(parsed),
      })
      .select()
      .single();
    if (error) throw error;
    return fromInsertedRow(data, null);
  } catch (error) {
    throw toCollectionError(error);
  }
}

/**
 * Merges changes into a hand-entered item's own data (`merge_item_custom_data`): present fields are
 * set, `null` fields removed, others kept. Returns the item as stored.
 */
export async function updateCustomItemData(
  client: FansteSupabaseClient,
  id: string,
  patch: CustomItemDataPatch,
): Promise<CollectionItem> {
  let parsed;
  try {
    parsed = customItemDataPatchSchema.parse(patch);
  } catch (error) {
    throw toCollectionError(error);
  }
  // `undefined` fields aren't sent: only present keys change.
  const json = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined),
  ) as Json;
  if (Object.keys(json as object).length > 0) {
    const { data, error } = await client.rpc('merge_item_custom_data', {
      p_id: id,
      p_patch: json,
    });
    if (error) throw toCollectionError(error);
    if (data.length === 0) throw new CollectionError('not_found', `No custom item ${id}.`);
  }
  const item = await getItem(client, id);
  if (!item) throw new CollectionError('not_found', `No item ${id}.`);
  return item;
}
