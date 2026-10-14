import { z } from 'zod';

// The user's own collections (FC-13): Funko Pops, LEGO sets, coins, ... Each one is a row of
// `custom_collections`; its items have `category = 'custom'` and point at it.

/** Same limit as the `custom_collections_before_insert` trigger. */
export const MAX_CUSTOM_COLLECTIONS = 50;
/** Same limits as the `custom_collections` check constraints. */
export const MAX_COLLECTION_NAME_LENGTH = 50;
export const MAX_COLLECTION_DESCRIPTION_LENGTH = 500;

/**
 * Icons a collection can have, as Lucide names (https://lucide.dev), like `CategoryIconName`. Each
 * app maps them to its own components. Mirrors the `custom_collections.icon` check: keep them equal.
 */
export const CUSTOM_COLLECTION_ICONS = [
  'shapes',
  'toy-brick',
  'blocks',
  'book-open',
  'library',
  'coins',
  'gem',
  'stamp',
  'footprints',
  'shirt',
  'watch',
  'glasses',
  'car-front',
  'plane',
  'train-front',
  'trophy',
  'medal',
  'camera',
  'palette',
  'guitar',
  'puzzle',
  'swords',
  'wine',
  'leaf',
  'star',
  'heart',
  'package',
  'box',
] as const;
export type CustomCollectionIcon = (typeof CUSTOM_COLLECTION_ICONS)[number];
export const customCollectionIconSchema = z.enum(CUSTOM_COLLECTION_ICONS);

/** The icon of a new collection, and the database default. */
export const DEFAULT_COLLECTION_ICON: CustomCollectionIcon = 'shapes';

const name = z.string().trim().min(1).max(MAX_COLLECTION_NAME_LENGTH);
/** Trimmed; an empty description is stored as `null`. */
const description = z
  .string()
  .trim()
  .max(MAX_COLLECTION_DESCRIPTION_LENGTH)
  .transform((value) => value || null)
  .nullable();

/** A new collection. Names are unique per user, ignoring case (`duplicate` otherwise). */
export const customCollectionInputSchema = z.object({
  name,
  description: description.optional(),
  icon: customCollectionIconSchema.optional(),
});

export type CustomCollectionInput = z.input<typeof customCollectionInputSchema>;

/** Changes to a collection: rename, new icon or description. The order has its own function. */
export const customCollectionPatchSchema = customCollectionInputSchema.partial();

export type CustomCollectionPatch = z.input<typeof customCollectionPatchSchema>;

/** A collection as the UI uses it. */
export interface CustomCollection {
  id: string;
  name: string;
  description: string | null;
  icon: CustomCollectionIcon;
  /** Position in the user's list, smallest first. */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** A stored icon name, or the default one if it isn't known (e.g. removed from the list later). */
export function parseCollectionIcon(value: unknown): CustomCollectionIcon {
  const result = customCollectionIconSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_COLLECTION_ICON;
}

/**
 * Whether `name` is already one of `existing` (ignoring case and surrounding spaces, like the
 * database), so a form can say so before saving. `exceptId` is the collection being renamed.
 */
export function isCollectionNameTaken(
  name: string,
  existing: readonly Pick<CustomCollection, 'id' | 'name'>[],
  exceptId?: string,
): boolean {
  const key = name.trim().toLowerCase();
  return existing.some(
    (collection) => collection.id !== exceptId && collection.name.trim().toLowerCase() === key,
  );
}
