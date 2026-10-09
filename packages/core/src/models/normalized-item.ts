import { z } from 'zod';

import { itemCategorySchema, metadataProviderSchema, providerSupportsCategory } from './enums';
import { isValidExternalId } from './external-id';

import type { ItemCategory, MetadataProvider } from './enums';

/**
 * Valid release years. Up to 4 digits, like `collection_items_view` reads from user input; year 0 is
 * rejected here because no provider uses it (the view would accept it).
 */
export const MIN_RELEASE_YEAR = 1;
export const MAX_RELEASE_YEAR = 9999;

const text = z.string().trim().min(1);
const httpUrl = z.url({ protocol: /^https?$/ });

/** Fields of `NormalizedItem`, without the cross-field checks (so `.pick()` keeps working). */
export const normalizedItemShape = z.object({
  provider: metadataProviderSchema,
  /**
   * The provider's ID in the format the database enforces (see `isValidExternalId`). Custom items
   * have no external ID; when one is normalized on read, this is the collection item's ID (FC-13).
   */
  externalId: text,
  category: itemCategorySchema,
  title: text,
  /** Artist / platform / studio / series. */
  subtitle: text.optional(),
  releaseYear: z.int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
  /** Poster / cover / box art. */
  imageUrl: httpUrl.optional(),
  thumbnailUrl: httpUrl.optional(),
  description: text.optional(),
  genres: z.array(text).optional(),
  /** Directors, artists, developers, designers. */
  creators: z.array(text).optional(),
  /**
   * Category-specific fields (runtime, seasons, tracklist, player count, ...). Parse them with the
   * category's schema, e.g. `parseMovieExtra` (see `extras.ts`).
   */
  extra: z.record(z.string(), z.unknown()).optional(),
  /** Link back to the provider's page (attribution, FC-27). */
  sourceUrl: httpUrl.optional(),
});

/** Checks the provider/category pairing and the external ID format, like the database does. */
export function checkProviderIdentity(
  value: { provider: MetadataProvider; category: ItemCategory; externalId: string },
  ctx: z.core.$RefinementCtx,
): void {
  if (!providerSupportsCategory(value.provider, value.category)) {
    ctx.addIssue({
      code: 'custom',
      message: `Provider "${value.provider}" has no "${value.category}" items.`,
      path: ['category'],
    });
    return;
  }
  if (
    value.provider !== 'custom' &&
    !isValidExternalId(value.provider, value.category, value.externalId)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: `"${value.externalId}" is not a valid ${value.provider} ID for "${value.category}".`,
      path: ['externalId'],
    });
  }
}

/**
 * One item from any provider, in the shape the whole app uses. Every provider adapter (FC-09…FC-13)
 * returns this, so the UI never handles provider payloads.
 */
export const normalizedItemSchema = normalizedItemShape.superRefine(checkProviderIdentity);

export type NormalizedItem = z.output<typeof normalizedItemSchema>;
