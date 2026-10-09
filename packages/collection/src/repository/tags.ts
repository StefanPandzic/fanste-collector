import { tagInputSchema } from '@fanste/core';

import { CollectionError, toCollectionError } from '../errors';
import { toTag } from './mappers';

import type { Tag, TagInput } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

/** The user's tags, by name. */
export async function listTags(client: FansteSupabaseClient): Promise<Tag[]> {
  const { data, error } = await client.from('tags').select('*').order('name');
  if (error) throw toCollectionError(error);
  return data.map(toTag);
}

/** Creates a tag. A name the user already has fails with `duplicate`. */
export async function createTag(client: FansteSupabaseClient, input: TagInput): Promise<Tag> {
  try {
    const { name, color } = tagInputSchema.parse(input);
    const { data, error } = await client
      .from('tags')
      .insert({ name, color: color ?? null })
      .select()
      .single();
    if (error) throw error;
    return toTag(data);
  } catch (error) {
    throw toCollectionError(error);
  }
}

/** Renames or recolors a tag. */
export async function updateTag(
  client: FansteSupabaseClient,
  id: string,
  input: Partial<TagInput>,
): Promise<Tag> {
  try {
    const patch = tagInputSchema.partial().parse(input);
    const { data, error } = await client
      .from('tags')
      .update({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.color !== undefined && { color: patch.color }),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new CollectionError('not_found', `No tag ${id}.`);
    return toTag(data);
  } catch (error) {
    throw toCollectionError(error);
  }
}

/** Deletes a tag and its links to items. */
export async function deleteTag(client: FansteSupabaseClient, id: string): Promise<void> {
  const { data, error } = await client.from('tags').delete().eq('id', id).select('id');
  if (error) throw toCollectionError(error);
  if (data.length === 0) throw new CollectionError('not_found', `No tag ${id}.`);
}

/** Puts a tag on an item. Assigning a tag the item already has does nothing. */
export async function assignTag(
  client: FansteSupabaseClient,
  itemId: string,
  tagId: string,
): Promise<void> {
  const { error } = await client
    .from('collection_item_tags')
    .upsert({ item_id: itemId, tag_id: tagId }, { ignoreDuplicates: true });
  if (error) throw toCollectionError(error);
}

/** Takes a tag off an item. */
export async function unassignTag(
  client: FansteSupabaseClient,
  itemId: string,
  tagId: string,
): Promise<void> {
  const { error } = await client
    .from('collection_item_tags')
    .delete()
    .eq('item_id', itemId)
    .eq('tag_id', tagId);
  if (error) throw toCollectionError(error);
}
