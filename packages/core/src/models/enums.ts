import { z } from 'zod';

// These mirror the Postgres enums of the same names (FC-05). `db-compat.test.ts` fails the typecheck
// when they drift from the generated `database.types.ts`.

/** `tv` is split from `movie` because TMDB uses separate endpoints and ID spaces for them. */
export const ITEM_CATEGORIES = [
  'movie',
  'tv',
  'music',
  'video_game',
  'board_game',
  'funko',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export const itemCategorySchema = z.enum(ITEM_CATEGORIES);

/** `custom` marks items the user enters by hand (Funko Pops, anything a provider lacks, FC-13). */
export const METADATA_PROVIDERS = ['tmdb', 'discogs', 'igdb', 'bgg', 'custom'] as const;
export type MetadataProvider = (typeof METADATA_PROVIDERS)[number];
export const metadataProviderSchema = z.enum(METADATA_PROVIDERS);

export const OWNERSHIP_STATUSES = [
  'owned',
  'wishlist',
  'preordered',
  'loaned_out',
  'sold',
] as const;
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number];
export const ownershipStatusSchema = z.enum(OWNERSHIP_STATUSES);

/** Metadata providers backed by an external API, i.e. every provider except `custom`. */
export type ExternalProvider = Exclude<MetadataProvider, 'custom'>;

/**
 * The categories each external provider serves. Mirrors the `*_provider_category` check constraints;
 * a custom item may have any category.
 */
export const PROVIDER_CATEGORIES = {
  tmdb: ['movie', 'tv'],
  discogs: ['music'],
  igdb: ['video_game'],
  bgg: ['board_game'],
} as const satisfies Record<ExternalProvider, readonly ItemCategory[]>;

/** The external provider that serves `category`, or `undefined` when none does (Funko Pops). */
export function providerOfCategory(category: ItemCategory): ExternalProvider | undefined {
  return (Object.keys(PROVIDER_CATEGORIES) as ExternalProvider[]).find((provider) =>
    (PROVIDER_CATEGORIES[provider] as readonly ItemCategory[]).includes(category),
  );
}

/** Whether `provider` may hold items of `category` (always true for `custom`). */
export function providerSupportsCategory(
  provider: MetadataProvider,
  category: ItemCategory,
): boolean {
  if (provider === 'custom') return true;
  return (PROVIDER_CATEGORIES[provider] as readonly ItemCategory[]).includes(category);
}
