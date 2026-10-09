import type { ExternalProvider, ItemCategory, NormalizedItem, SearchResponse } from '@fanste/core';

export interface SearchOptions {
  category: ItemCategory;
  page: number;
  year?: number;
}

/**
 * One metadata provider behind the gateway (FC-09 – FC-12). Adapters make their HTTP calls through
 * `providerFetch()`, so the provider's rate limit and retries apply, and return normalized data only.
 * Throw a `GatewayError('not_found', …)` when the provider has no such item.
 */
export interface ProviderAdapter {
  provider: ExternalProvider;
  categories: readonly ItemCategory[];
  /** `year` narrows the results to that release year; adapters whose provider can't filter ignore it. */
  search(q: string, opts: SearchOptions): Promise<SearchResponse>;
  getById(externalId: string, category: ItemCategory): Promise<NormalizedItem>;
}
