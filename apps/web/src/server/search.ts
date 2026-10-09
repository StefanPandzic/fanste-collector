import type { LruCache } from './cache/lru';
import type { ProviderRegistry } from './providers/registry';
import type { ItemCategory, SearchResponse } from '@fanste/core';

export interface SearchServiceDeps {
  registry: ProviderRegistry;
  /** Per-instance cache of recent searches. */
  cache: LruCache<SearchResponse>;
}

export interface SearchService {
  search(query: { category: ItemCategory; q: string; page: number }): Promise<SearchResponse>;
}

/** Searches the category's provider, with an in-memory cache in front. */
export function createSearchService({ registry, cache }: SearchServiceDeps): SearchService {
  return {
    async search({ category, q, page }) {
      const adapter = registry.forCategory(category);
      const key = [category, q.trim().toLowerCase(), page].join('\u0000');
      const cached = cache.get(key);
      if (cached) return cached;

      const response = await adapter.search(q, { category, page });
      cache.set(key, response);
      return response;
    },
  };
}
