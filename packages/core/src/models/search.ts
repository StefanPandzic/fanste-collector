import { z } from 'zod';

import { checkProviderIdentity, normalizedItemShape } from './normalized-item';

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
