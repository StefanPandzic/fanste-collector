import { z } from 'zod';

import {
  customCollectionInputSchema,
  customCollectionPatchSchema,
  DEFAULT_COLLECTION_ICON,
} from '@fanste/core';

import { CollectionError, toCollectionError } from '../errors';
import { toCustomCollection } from './mappers';

import type { CustomCollection, CustomCollectionInput, CustomCollectionPatch } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

// The user's own collections (FC-13). Their items are ordinary `collection_items` rows with
// `category = 'custom'`; deleting a collection deletes them (`on delete cascade`).

/** The user's custom collections, in their order (RLS limits them to the user's own). */
export async function listCustomCollections(
  client: FansteSupabaseClient,
): Promise<CustomCollection[]> {
  const { data, error } = await client
    .from('custom_collections')
    .select('*')
    .order('sort_order')
    .order('created_at');
  if (error) throw toCollectionError(error);
  return data.map(toCustomCollection);
}

/**
 * Creates a collection at the end of the user's list. A name the user already has (ignoring case)
 * fails with `duplicate`, a 51st collection with `limit_reached`.
 */
export async function createCustomCollection(
  client: FansteSupabaseClient,
  input: CustomCollectionInput,
): Promise<CustomCollection> {
  try {
    const { name, description, icon } = customCollectionInputSchema.parse(input);
    const { data, error } = await client
      .from('custom_collections')
      .insert({ name, description: description ?? null, icon: icon ?? DEFAULT_COLLECTION_ICON })
      .select()
      .single();
    if (error) throw error;
    return toCustomCollection(data);
  } catch (error) {
    throw toCollectionError(error);
  }
}

/** Renames a collection or changes its icon or description. */
export async function updateCustomCollection(
  client: FansteSupabaseClient,
  id: string,
  patch: CustomCollectionPatch,
): Promise<CustomCollection> {
  try {
    const parsed = customCollectionPatchSchema.parse(patch);
    const { data, error } = await client
      .from('custom_collections')
      .update({
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.description !== undefined && { description: parsed.description }),
        ...(parsed.icon !== undefined && { icon: parsed.icon }),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new CollectionError('not_found', `No collection ${id}.`);
    return toCustomCollection(data);
  } catch (error) {
    throw toCollectionError(error);
  }
}

/** Deletes a collection and every item in it. */
export async function deleteCustomCollection(
  client: FansteSupabaseClient,
  id: string,
): Promise<void> {
  const { data, error } = await client
    .from('custom_collections')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw toCollectionError(error);
  if (data.length === 0) throw new CollectionError('not_found', `No collection ${id}.`);
}

/** Puts the user's collections in the order of `ids` (the first one first). */
export async function reorderCustomCollections(
  client: FansteSupabaseClient,
  ids: readonly string[],
): Promise<void> {
  const valid = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
  if (valid.length === 0) return;
  const { error } = await client.rpc('reorder_custom_collections', { p_ids: valid });
  if (error) throw toCollectionError(error);
}
