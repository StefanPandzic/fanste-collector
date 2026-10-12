import { z } from 'zod';

import { checkProviderIdentity, normalizedItemShape } from './normalized-item';

/** Longest `SearchResult.detail`. */
export const MAX_SEARCH_DETAIL_LENGTH = 300;

/** The lightweight part of a `NormalizedItem` shown in result lists. */
export const searchResultSchema = normalizedItemShape
  .pick({
    provider: true,
    externalId: true,
    category: true,
    title: true,
    subtitle: true,
    releaseYear: true,
    thumbnailUrl: true,
  })
  .extend({
    /**
     * A line that tells similar results apart, shown under the subtitle. Discogs (FC-10) sets the
     * pressing: `Vinyl, LP, Album · UK · PCS 7088`. Search lists only; items don't have it.
     */
    detail: z.string().trim().min(1).max(MAX_SEARCH_DETAIL_LENGTH).optional(),
  })
  .superRefine(checkProviderIdentity);

export type SearchResult = z.output<typeof searchResultSchema>;

/** One page of search results. `page` starts at 1. */
export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  page: z.int().min(1),
  totalPages: z.int().min(0),
  totalResults: z.int().min(0),
});

export type SearchResponse = z.output<typeof searchResponseSchema>;
