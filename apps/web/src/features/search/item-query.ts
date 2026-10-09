import { queryOptions } from '@tanstack/react-query';

import { isRetryableSearchError } from './search-errors';

import type { AddTarget } from './add-item-form';
import type { ApiClient } from '@fanste/api-client';

/**
 * The full provider item behind a search result (`GET /api/items/:provider/:externalId`), which the
 * add dialog and quick add prefill from. Shared by both, so opening the dialog after a quick add
 * (or the other way round) doesn't load it twice.
 */
export function providerItemQuery(api: ApiClient, { provider, externalId }: AddTarget) {
  return queryOptions({
    queryKey: ['provider-item', provider, externalId],
    queryFn: ({ signal }) => api.getItem({ provider, externalId }, { signal }),
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => failureCount < 2 && isRetryableSearchError(error),
  });
}
