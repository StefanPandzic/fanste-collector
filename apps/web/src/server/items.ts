import { categoryOfExternalId } from '@fanste/core';

import { isStale, refKey } from './cache/metadata-cache';
import { GatewayError } from './errors';
import { PROVIDER_LIMITS } from './limits';
import { gatewayLog } from './log';

import type { CachedItem, MetadataCacheStore } from './cache/metadata-cache';
import type { ProviderRegistry } from './providers/registry';
import type {
  BatchResponse,
  ExternalProvider,
  ItemRef,
  MissingItem,
  NormalizedItem,
} from '@fanste/core';

export interface ItemServiceDeps {
  registry: ProviderRegistry;
  cache: MetadataCacheStore;
  /** Runs work after the response is sent (`after()` from `next/server`). */
  runInBackground: (task: () => Promise<void>) => void;
  now?: () => Date;
}

export interface ItemService {
  /** One item, cache-first. A stale row is returned at once and refreshed in the background. */
  getItem(ref: ItemRef): Promise<NormalizedItem>;
  /**
   * Many items: one cache read, then only the misses go to the providers (throttled), at most
   * `maxFetchesPerRequest` per provider. Misses beyond that, and failed fetches, are reported in
   * `missing`: `not_found` when the provider has no such item, otherwise `retry_later`.
   */
  getItemsBatch(refs: readonly ItemRef[]): Promise<BatchResponse>;
}

// Refreshes already running on this instance, so a popular stale item is refreshed once.
const refreshing = new Set<string>();

/** Splits `refs` into those within each provider's per-request fetch budget and the rest. */
export function capPerProvider(refs: readonly ItemRef[]): { within: ItemRef[]; over: ItemRef[] } {
  const counts = new Map<ExternalProvider, number>();
  const within: ItemRef[] = [];
  const over: ItemRef[] = [];
  for (const ref of refs) {
    const count = counts.get(ref.provider) ?? 0;
    if (count < PROVIDER_LIMITS[ref.provider].maxFetchesPerRequest) {
      counts.set(ref.provider, count + 1);
      within.push(ref);
    } else {
      over.push(ref);
    }
  }
  return { within, over };
}

export function createItemService({
  registry,
  cache,
  runInBackground,
  now = () => new Date(),
}: ItemServiceDeps): ItemService {
  /** Fetches an item from its provider. Doesn't cache it. */
  async function fetchFromProvider(ref: ItemRef): Promise<NormalizedItem> {
    const category = categoryOfExternalId(ref.provider, ref.externalId);
    if (!category) throw new GatewayError('bad_request', 'Invalid external ID for this provider.');

    const item = await registry.forProvider(ref.provider).getById(ref.externalId, category);
    if (item.provider !== ref.provider || item.externalId !== ref.externalId) {
      throw new GatewayError('provider_error', `${ref.provider} returned a different item.`, {
        provider: ref.provider,
      });
    }
    return item;
  }

  /** Fetches many items; failures are logged and returned as `failed` instead of thrown. */
  async function fetchMany(
    refs: readonly ItemRef[],
    event: string,
  ): Promise<{ fetched: NormalizedItem[]; failed: MissingItem[] }> {
    const results = await Promise.allSettled(refs.map(fetchFromProvider));
    const fetched: NormalizedItem[] = [];
    const failed: MissingItem[] = [];
    results.forEach((result, index) => {
      const ref = refs[index];
      if (!ref) return;
      if (result.status === 'fulfilled') {
        fetched.push(result.value);
        return;
      }
      const reason: unknown = result.reason;
      const notFound = reason instanceof GatewayError && reason.code === 'not_found';
      failed.push({ ...ref, reason: notFound ? 'not_found' : 'retry_later' });
      if (reason instanceof GatewayError) {
        gatewayLog.warn(event, { item: refKey(ref), code: reason.code });
      } else {
        gatewayLog.error(event, { item: refKey(ref) }, reason);
      }
    });
    return { fetched, failed };
  }

  /**
   * Reads the shared cache. If the read fails it's logged and treated as all misses, so the
   * providers (behind their throttles and per-request caps) can still answer.
   */
  async function readCache(refs: readonly ItemRef[]): Promise<CachedItem[]> {
    try {
      return await cache.getMany(refs);
    } catch (error) {
      gatewayLog.error('cache.read_failed', { count: refs.length }, error);
      return [];
    }
  }

  /** Writes to the shared cache. A failed write is logged, never shown to the user. */
  async function store(items: readonly NormalizedItem[]): Promise<void> {
    if (items.length === 0) return;
    try {
      await cache.upsert(items);
    } catch (error) {
      gatewayLog.error('cache.write_failed', { count: items.length }, error);
    }
  }

  /** Refreshes stale rows after the response, within the per-request fetch budget. */
  function refreshInBackground(refs: readonly ItemRef[]): void {
    const { within } = capPerProvider(refs.filter((ref) => !refreshing.has(refKey(ref))));
    if (within.length === 0) return;
    for (const ref of within) refreshing.add(refKey(ref));

    runInBackground(async () => {
      try {
        const { fetched } = await fetchMany(within, 'cache.refresh_failed');
        await store(fetched);
      } finally {
        for (const ref of within) refreshing.delete(refKey(ref));
      }
    });
  }

  return {
    async getItem(ref) {
      const [cached] = await readCache([ref]);
      if (cached) {
        if (isStale(cached.fetchedAt, ref.provider, now())) refreshInBackground([ref]);
        return cached.item;
      }
      const item = await fetchFromProvider(ref);
      await store([item]);
      return item;
    },

    async getItemsBatch(refs) {
      const unique = [...new Map(refs.map((ref) => [refKey(ref), ref])).values()];
      const cached = new Map((await readCache(unique)).map((entry) => [refKey(entry.item), entry]));

      const items: NormalizedItem[] = [];
      const stale: ItemRef[] = [];
      const misses: ItemRef[] = [];
      for (const ref of unique) {
        const entry = cached.get(refKey(ref));
        if (!entry) {
          misses.push(ref);
          continue;
        }
        items.push(entry.item);
        if (isStale(entry.fetchedAt, ref.provider, now())) stale.push(ref);
      }
      if (stale.length > 0) refreshInBackground(stale);

      // Each adapter call waits for its provider's throttle; the cap keeps one batch from
      // filling the provider's queue for everyone else.
      const { within, over } = capPerProvider(misses);
      const { fetched, failed } = await fetchMany(within, 'batch.fetch_failed');
      await store(fetched);

      const deferred = over.map((ref): MissingItem => ({ ...ref, reason: 'retry_later' }));
      return { items: [...items, ...fetched], missing: [...failed, ...deferred] };
    },
  };
}
