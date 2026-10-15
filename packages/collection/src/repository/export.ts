import { ApiClientError } from '@fanste/api-client';
import { EXTERNAL_PROVIDERS, MAX_BATCH_ITEMS, MAX_COLLECTION_PAGE_SIZE } from '@fanste/core';

import { toCollectionError } from '../errors';
import { refKey } from './copies';
import { listItems } from './items';
import { ITEM_VIEW_SELECT, toCollectionItem } from './mappers';

import type { ItemViewRow } from './mappers';
import type {
  BatchResponse,
  CollectionFilter,
  CollectionItem,
  ExternalProvider,
  ItemRef,
  NormalizedItem,
} from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

// Loading every item of an export (FC-25, FC-26). The file itself is built on the client.

/** Ids per request, so the `in.(...)` filter stays well within URL limits. */
const ID_CHUNK = 100;
/** Least time between two batch requests, so a large export stays inside the user's rate limit. */
export const EXPORT_REQUEST_GAP_MS = 1200;
/** Times a `rate_limited` answer is waited out before the rest is exported without metadata. */
const RATE_LIMIT_RETRIES = 3;
const DEFAULT_RETRY_AFTER_S = 30;
const MAX_RETRY_AFTER_S = 120;
/** Batch requests in a row that load nothing before the rest is exported without metadata. */
const MAX_STALLED_BATCHES = 3;

/** Waits `ms`, or rejects at once when `signal` aborts (a closed dialog stops a rate-limit wait). */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Which items to export: those matching any of `filters`, or the items with these `ids`. */
export type ExportScope = { filters: readonly CollectionFilter[] } | { ids: readonly string[] };

export interface ExportProgress {
  /** Loading the items, then the metadata that isn't cached yet. */
  phase: 'items' | 'metadata';
  /** Items (or metadata refs) loaded so far. */
  loaded: number;
  /** All to load, once the first page tells. */
  total: number;
}

export interface LoadExportItemsDeps {
  /** The gateway's batch endpoint (`api.getItemsBatch`), for metadata that isn't cached yet. */
  getItemsBatch: (
    refs: readonly ItemRef[],
    options?: { signal?: AbortSignal },
  ) => Promise<BatchResponse>;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
  /** For tests. */
  sleep?: (ms: number) => Promise<void>;
  requestGapMs?: number;
}

export interface ExportItems {
  items: CollectionItem[];
  /** Provider items exported without metadata, because the gateway couldn't load it. */
  missingMetadata: number;
}

/** Every item matching `filter`, a page of `MAX_COLLECTION_PAGE_SIZE` at a time. */
async function loadFiltered(
  client: FansteSupabaseClient,
  filter: CollectionFilter,
  onPage: (items: CollectionItem[], total: number) => void,
  signal: AbortSignal | undefined,
): Promise<void> {
  for (let page = 1; ; page += 1) {
    signal?.throwIfAborted();
    // Oldest first, so items added while the export loads land on later pages, not shift earlier ones.
    const result = await listItems(client, {
      ...filter,
      sort: 'added_asc',
      page,
      pageSize: MAX_COLLECTION_PAGE_SIZE,
    });
    onPage(result.items, result.total);
    if (result.items.length < MAX_COLLECTION_PAGE_SIZE) return;
  }
}

async function loadByIds(
  client: FansteSupabaseClient,
  ids: readonly string[],
  onPage: (items: CollectionItem[], total: number) => void,
  signal: AbortSignal | undefined,
): Promise<void> {
  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    signal?.throwIfAborted();
    const { data, error } = await client
      .from('collection_items_view')
      .select(ITEM_VIEW_SELECT)
      .in('id', ids.slice(start, start + ID_CHUNK));
    if (error) throw toCollectionError(error);
    onPage((data as unknown as ItemViewRow[]).map(toCollectionItem), ids.length);
  }
}

/** Provider items without cached metadata. */
function missingRefs(items: Iterable<CollectionItem>): ItemRef[] {
  const refs = new Map<string, ItemRef>();
  for (const item of items) {
    if (item.metadata || item.externalId === null) continue;
    if (!(EXTERNAL_PROVIDERS as readonly string[]).includes(item.provider)) continue;
    const ref = { provider: item.provider as ExternalProvider, externalId: item.externalId };
    refs.set(refKey(ref), ref);
  }
  return [...refs.values()];
}

/**
 * Asks the gateway for the metadata of `refs`, one batch request at a time and spaced
 * `requestGapMs` apart. Refs it defers (`retry_later`: each request loads only a few cache misses
 * per provider) are asked for again; a `rate_limited` answer is waited out. Stops early when the
 * gateway fails, or makes no progress for a few rounds in a row.
 */
async function fillMetadata(
  refs: readonly ItemRef[],
  deps: Required<Pick<LoadExportItemsDeps, 'getItemsBatch' | 'sleep' | 'requestGapMs'>> &
    Pick<LoadExportItemsDeps, 'onProgress' | 'signal'>,
): Promise<Map<string, NormalizedItem>> {
  const { getItemsBatch, onProgress, signal, sleep, requestGapMs } = deps;
  const metadata = new Map<string, NormalizedItem>();
  let queue = [...refs];
  let done = 0;
  let stalled = 0;
  let rateLimited = 0;
  let first = true;
  while (queue.length > 0) {
    signal?.throwIfAborted();
    if (!first) await sleep(requestGapMs);
    first = false;
    const batch = queue.slice(0, MAX_BATCH_ITEMS);
    let response: BatchResponse;
    try {
      response = await getItemsBatch(batch, { ...(signal && { signal }) });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (
        error instanceof ApiClientError &&
        error.code === 'rate_limited' &&
        rateLimited < RATE_LIMIT_RETRIES
      ) {
        rateLimited += 1;
        await sleep(
          Math.min(error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_S, MAX_RETRY_AFTER_S) * 1000,
        );
        continue;
      }
      // The gateway is busy or down: export the rest without their metadata.
      break;
    }
    for (const loaded of response.items) {
      metadata.set(`${loaded.provider}:${loaded.externalId}`, loaded);
    }
    const deferred = response.missing.filter((missing) => missing.reason === 'retry_later');
    done += batch.length - deferred.length;
    onProgress?.({ phase: 'metadata', loaded: done, total: refs.length });
    rateLimited = 0;
    // Only deferred refs stay in the queue; `not_found` ones leave it, so they are progress too.
    stalled = deferred.length === batch.length ? stalled + 1 : 0;
    if (stalled >= MAX_STALLED_BATCHES) break;
    queue = [
      ...queue.slice(MAX_BATCH_ITEMS),
      ...deferred.map(({ provider, externalId }) => ({ provider, externalId })),
    ];
  }
  return metadata;
}

/**
 * Loads the items of an export with their metadata. Metadata that isn't cached yet is loaded through
 * the gateway (`fillMetadata`); items it still can't load are exported without it (their
 * overrides, IDs and copy fields are still there) and counted in `missingMetadata`.
 */
export async function loadExportItems(
  client: FansteSupabaseClient,
  scope: ExportScope,
  {
    getItemsBatch,
    onProgress,
    signal,
    sleep = (ms) => abortableSleep(ms, signal),
    requestGapMs = EXPORT_REQUEST_GAP_MS,
  }: LoadExportItemsDeps,
): Promise<ExportItems> {
  const items = new Map<string, CollectionItem>();
  try {
    if ('ids' in scope) {
      await loadByIds(
        client,
        scope.ids,
        (page, total) => {
          for (const item of page) items.set(item.id, item);
          onProgress?.({ phase: 'items', loaded: items.size, total });
        },
        signal,
      );
    } else {
      let previousTotals = 0;
      for (const filter of scope.filters) {
        let filterTotal = 0;
        await loadFiltered(
          client,
          filter,
          (page, total) => {
            filterTotal = total;
            for (const item of page) items.set(item.id, item);
            onProgress?.({ phase: 'items', loaded: items.size, total: previousTotals + total });
          },
          signal,
        );
        previousTotals += filterTotal;
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw toCollectionError(error);
  }

  const refs = missingRefs(items.values());
  if (refs.length === 0) return { items: [...items.values()], missingMetadata: 0 };
  const metadata = await fillMetadata(refs, {
    getItemsBatch,
    onProgress,
    signal,
    sleep,
    requestGapMs,
  });
  let missingMetadata = 0;
  for (const [id, item] of items) {
    if (item.metadata || item.externalId === null) continue;
    const loaded = metadata.get(`${item.provider}:${item.externalId}`);
    if (loaded) items.set(id, { ...item, metadata: loaded });
    else missingMetadata += 1;
  }
  return { items: [...items.values()], missingMetadata };
}
