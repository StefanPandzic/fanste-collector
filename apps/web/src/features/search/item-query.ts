import { queryOptions, skipToken } from '@tanstack/react-query';

import { isRetryableSearchError } from './search-errors';

import type { AddTarget } from './add-item-form';
import type { ApiClient } from '@fanste/api-client';

/**
 * The full provider item behind a search result or collection item
 * (`GET /api/items/:provider/:externalId`), which the add dialog and quick add prefill from and the
 * item page (FC-19) loads in the background. Shared, so the same item is never loaded twice. Without
 * a target (a custom item) the query doesn't run.
 */
export function providerItemQuery(api: ApiClient, target: AddTarget | undefined) {
  return queryOptions({
    queryKey: ['provider-item', target?.provider, target?.externalId],
    queryFn: target
      ? ({ signal }) =>
          api.getItem({ provider: target.provider, externalId: target.externalId }, { signal })
      : skipToken,
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => failureCount < 2 && isRetryableSearchError(error),
  });
}
