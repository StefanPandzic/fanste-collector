import type {
  ExternalProvider,
  ItemCategory,
  MusicSearchFormat,
  NormalizedItem,
  SearchResponse,
} from '@fanste/core';

export interface SearchOptions {
  category: ItemCategory;
  page: number;
  year?: number;
  /** Music only (Discogs, FC-10); other adapters ignore them. */
  format?: MusicSearchFormat;
  /** The release country, e.g. `UK`. */
  country?: string;
  /** A barcode or catalog number; with it, `q` may be empty. */
  code?: string;
}

/**
 * One metadata provider behind the gateway (FC-09 – FC-12). Adapters make their HTTP calls through
 * `providerFetch()`, so the provider's rate limit and retries apply, and return normalized data only.
 * Throw a `GatewayError('not_found', …)` when the provider has no such item.
 */
export interface ProviderAdapter {
  provider: ExternalProvider;
  categories: readonly ItemCategory[];
  /**
   * `year` (and `format`) narrow the results; adapters whose provider can't filter on one ignore it.
   */
  search(q: string, opts: SearchOptions): Promise<SearchResponse>;
  getById(externalId: string, category: ItemCategory): Promise<NormalizedItem>;
}
