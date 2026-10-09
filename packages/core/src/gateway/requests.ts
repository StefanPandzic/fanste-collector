import { z } from 'zod';

import { itemCategorySchema, PROVIDER_CATEGORIES } from '../models/enums';
import { isValidExternalId } from '../models/external-id';
import {
  MAX_RELEASE_YEAR,
  MIN_RELEASE_YEAR,
  normalizedItemSchema,
} from '../models/normalized-item';
import { searchResultSchema } from '../models/search';

import type { ExternalProvider, ItemCategory } from '../models/enums';

// Request and response contracts of the API gateway (FC-08), shared by the route handlers and
// `@fanste/api-client`.

/** Providers with an external API, i.e. the ones the gateway can fetch from. */
export const EXTERNAL_PROVIDERS = [
  'tmdb',
  'discogs',
  'igdb',
  'bgg',
] as const satisfies readonly ExternalProvider[];
export const externalProviderSchema = z.enum(EXTERNAL_PROVIDERS);

export const MAX_SEARCH_QUERY_LENGTH = 200;
export const MAX_SEARCH_PAGE = 500;
/** Most items one `POST /api/items/batch` may ask for (a gallery page). */
export const MAX_BATCH_ITEMS = 100;
/** Most titles one `POST /api/match/tmdb` may match (FC-23 sends the scanner's files in batches). */
export const MAX_MATCH_QUERIES = 20;

/**
 * `GET /api/search?category=&q=&page=&year=`. Coerces `page` and `year`, so it parses query-string
 * values too. `year` narrows the results to that release year where the provider supports it (TMDB);
 * other providers ignore it.
 */
export const searchQuerySchema = z.object({
  category: itemCategorySchema,
  q: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
  page: z.coerce.number().int().min(1).max(MAX_SEARCH_PAGE).default(1),
  year: z.coerce.number().int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
});
/** A search as clients send it; `page` defaults to 1. */
export type SearchQuery = Omit<z.output<typeof searchQuerySchema>, 'page'> & { page?: number };

/**
 * The category an external ID belongs to, or `undefined` if the ID isn't valid for the provider.
 * TMDB IDs carry it (`movie:603`); every other provider has a single category.
 */
export function categoryOfExternalId(
  provider: ExternalProvider,
  externalId: string,
): ItemCategory | undefined {
  const categories: readonly ItemCategory[] = PROVIDER_CATEGORIES[provider];
  return categories.find((category) => isValidExternalId(provider, category, externalId));
}

/** One provider item, as the client names it (`GET /api/items/:provider/:externalId`, batch). */
export const itemRefSchema = z
  .object({ provider: externalProviderSchema, externalId: z.string() })
  .refine((ref) => categoryOfExternalId(ref.provider, ref.externalId) !== undefined, {
    message: 'Invalid external ID for this provider.',
    path: ['externalId'],
  });
export type ItemRef = z.output<typeof itemRefSchema>;

/** `GET /api/items/:provider/:externalId` returns the full item. */
export const itemResponseSchema = normalizedItemSchema;

/** `POST /api/items/batch`. */
export const batchRequestSchema = z.object({
  items: z.array(itemRefSchema).min(1).max(MAX_BATCH_ITEMS),
});
export type BatchRequest = z.output<typeof batchRequestSchema>;

/**
 * Why a batch ref has no item:
 * - `not_found`: the provider doesn't have it (deleted or never existed). Don't ask again.
 * - `retry_later`: the provider failed, or the request used up its per-provider fetch budget.
 */
export const MISSING_REASONS = ['not_found', 'retry_later'] as const;
export type MissingReason = (typeof MISSING_REASONS)[number];

/** A batch ref the gateway couldn't load, with the reason. */
export const missingItemSchema = z.object({
  provider: externalProviderSchema,
  externalId: z.string(),
  reason: z.enum(MISSING_REASONS),
});
export type MissingItem = z.output<typeof missingItemSchema>;

/** Items in no particular order, plus the refs that couldn't be loaded (see `MissingReason`). */
export const batchResponseSchema = z.object({
  items: z.array(normalizedItemSchema),
  missing: z.array(missingItemSchema),
});
export type BatchResponse = z.output<typeof batchResponseSchema>;

/** One title the scanner wants matched on TMDB (FC-23). */
export const matchQuerySchema = z.object({
  title: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
  year: z.int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
  kind: z.enum(['movie', 'tv']),
});
export type MatchQuery = z.output<typeof matchQuerySchema>;

/** `POST /api/match/tmdb`. */
export const matchRequestSchema = z.object({
  queries: z.array(matchQuerySchema).min(1).max(MAX_MATCH_QUERIES),
});
export type MatchRequest = z.output<typeof matchRequestSchema>;

/** A possible match and how sure we are of it, from 0 to 1. */
export const matchCandidateSchema = z.object({
  item: searchResultSchema,
  confidence: z.number().min(0).max(1),
});
export type MatchCandidate = z.output<typeof matchCandidateSchema>;

/** One entry per query, in request order, each with its best candidates first. */
export const matchResponseSchema = z.object({
  results: z.array(z.object({ candidates: z.array(matchCandidateSchema) })),
});
export type MatchResponse = z.output<typeof matchResponseSchema>;
