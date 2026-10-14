import { z } from 'zod';

import { jsonByteLength, parseFields } from './lenient';
import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR } from './normalized-item';

import type { ItemCategory } from './enums';
import type { NormalizedItem } from './normalized-item';

// What the user types about an item they enter by hand (FC-13), stored in
// `collection_items.custom_data`: the items of custom collections, and items of an integrated
// category that its provider lacks ("Can't find it? Add manually"). Keys are camelCase like the
// normalized item, so `collection_items_view` reads `title`, `subtitle`, `releaseYear` and `imageUrl`
// from it. The fields fit any kind of object; per-collection fields are backlog
// (`custom_data.fields`), and these keys stay valid when they come.

export const MAX_CUSTOM_TITLE_LENGTH = 200;
export const MAX_CUSTOM_SUBTITLE_LENGTH = 200;
export const MAX_CUSTOM_IDENTIFIER_LENGTH = 50;
export const MAX_CUSTOM_CREATOR_LENGTH = 100;
export const MAX_CUSTOM_CREATORS = 20;
export const MAX_CUSTOM_DESCRIPTION_LENGTH = 5000;
export const MAX_IMAGE_URL_LENGTH = 2048;
/**
 * Largest `custom_data` object as JSON, which keeps one item's row small (the free tier has 500 MB).
 * The database allows twice as much (`collection_items_custom_data_size`), so this check fails first.
 */
export const MAX_CUSTOM_DATA_BYTES = 16 * 1024;

const text = (max: number) => z.string().trim().min(1).max(max);

/** An https image: an upload's public URL in the `custom-images` bucket, or a pasted address. */
export const imageUrlSchema = z.url({ protocol: /^https$/ }).max(MAX_IMAGE_URL_LENGTH);

/** Fields of `custom_data`. Every field but the title is optional. */
export const customItemDataShape = {
  title: text(MAX_CUSTOM_TITLE_LENGTH),
  /** Series, line or theme, e.g. `Marvel` or `Star Wars`. */
  subtitle: text(MAX_CUSTOM_SUBTITLE_LENGTH).optional(),
  /** Number or code, e.g. `#123` (a Funko Pop) or `75192` (a LEGO set). */
  identifier: text(MAX_CUSTOM_IDENTIFIER_LENGTH).optional(),
  releaseYear: z.int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
  /** Brand, maker, author or artist; unique, in order. */
  creators: z
    .array(text(MAX_CUSTOM_CREATOR_LENGTH))
    .max(MAX_CUSTOM_CREATORS)
    .transform((names) => [...new Set(names)])
    .optional(),
  description: text(MAX_CUSTOM_DESCRIPTION_LENGTH).optional(),
  /** The item's photo, also its cover. */
  imageUrl: imageUrlSchema.optional(),
};

export const customItemDataSchema = z
  .object(customItemDataShape)
  .refine(
    (value) => jsonByteLength(value) <= MAX_CUSTOM_DATA_BYTES,
    `Item data can be at most ${MAX_CUSTOM_DATA_BYTES / 1024} KB.`,
  );

export type CustomItemData = z.output<typeof customItemDataSchema>;
export type CustomItemField = keyof CustomItemData;

/**
 * Reads stored `custom_data`: keeps the valid fields and drops the rest, so it never throws.
 * `null` when there is no valid title (not a custom item, or broken data).
 */
export function parseCustomItemData(value: unknown): CustomItemData | null {
  const data = parseFields(customItemDataShape, value);
  return data.title === undefined ? null : (data as CustomItemData);
}

/** e.g. `#123 · Marvel`: the number first, so items of a series can be told apart. */
export function customItemSubtitle(data: Pick<CustomItemData, 'identifier' | 'subtitle'>) {
  const parts = [data.identifier, data.subtitle].filter((part) => part !== undefined);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * A hand-entered item as a `NormalizedItem`, so cards, search badges and exports treat it like a
 * provider item. It has no external ID, so `externalId` is the collection item's ID.
 */
export function customItemToNormalized(item: {
  id: string;
  category: ItemCategory;
  customData: CustomItemData;
}): NormalizedItem {
  const { title, releaseYear, creators, description, imageUrl } = item.customData;
  const subtitle = customItemSubtitle(item.customData);
  return {
    provider: 'custom',
    externalId: item.id,
    category: item.category,
    title,
    ...(subtitle !== undefined && { subtitle }),
    ...(releaseYear !== undefined && { releaseYear }),
    ...(imageUrl !== undefined && { imageUrl, thumbnailUrl: imageUrl }),
    ...(description !== undefined && { description }),
    ...(creators !== undefined && creators.length > 0 && { creators }),
  };
}
