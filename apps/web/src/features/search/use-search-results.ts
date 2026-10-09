'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { useCollectionContext } from '@fanste/collection';
import { MAX_SEARCH_PAGE } from '@fanste/core';

import { isRetryableSearchError } from './search-errors';

import type { ItemCategory } from '@fanste/core';

/** Retries of a busy provider before the error is shown: about 1 s, 2 s and 4 s apart. */
const MAX_RETRIES = 3;

export interface SearchRequest {
  category: ItemCategory;
  /** Trimmed and not empty. */
  q: string;
  year?: number;
}

/**
 * Pages of provider results for a search, loaded one by one ("load more"). Busy providers and
 * dropped connections are retried; `failureCount > 0` while `isFetching` means a retry is pending.
 */
export function useSearchResults(request: SearchRequest | null) {
  const { api } = useCollectionContext();
  return useInfiniteQuery({
    // Results are the same for every user, so the key has no user ID.
    queryKey: ['search', request?.category, request?.q, request?.year ?? null],
    queryFn: ({ pageParam, signal }) => {
      if (!request) throw new Error('No search to run.');
      return api.search({ ...request, page: pageParam }, { signal });
    },
    enabled: request !== null,
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < Math.min(last.totalPages, MAX_SEARCH_PAGE) ? last.page + 1 : undefined,
    retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryableSearchError(error),
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 5 * 60 * 1000,
  });
}
