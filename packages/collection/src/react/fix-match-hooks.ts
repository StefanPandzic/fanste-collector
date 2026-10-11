import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { topSuggestionGroups } from '@fanste/core';

import { useCollectionContext } from './context';
import {
  collectionKeys,
  collectionMutationKey,
  itemFileDetailsKeys,
  itemScannedFilesKeys,
  scannedFilesKey,
} from './query-keys';
import { CollectionError, toCollectionError } from '../errors';
import { refKey } from '../repository/copies';
import { linkFilesToItem, relinkScannedFiles } from '../repository/scan-matching';
import { listItemScannedFiles, mergeScannedFiles } from '../repository/scanned-files';

import type { CollectionContextValue } from './context';
import type { ScannedFile } from '../repository/scanned-files';
import type { ApiClient } from '@fanste/api-client';
import type { ItemRef, NormalizedItem } from '@fanste/core';
import type { QueryClient } from '@tanstack/react-query';

/**
 * The scanned files (any device, removed ones included) linked to an item (FC-24), for the item
 * page's "Files" list and Fix Match. Fix Match and the background matcher refresh it.
 */
export function useItemScannedFiles(itemId: string | undefined) {
  const { client, userId } = useCollectionContext();
  return useQuery({
    queryKey: itemScannedFilesKeys.item(userId, itemId ?? ''),
    queryFn: () => listItemScannedFiles(client, itemId ?? ''),
    enabled: itemId !== undefined,
  });
}

/** A Fix Match choice (FC-24) for some scanned files. */
export type ScannedFileFix =
  /** Link the files to this provider item (its `Digital file` copy is added or filled). */
  | { kind: 'link'; files: readonly ScannedFile[]; ref: ItemRef }
  /** Link each file to its best stored candidate ("Accept top suggestion"). */
  | { kind: 'accept'; files: readonly ScannedFile[] }
  /** `ignore`: keep them out of matching. `restore`: hand them back to the background matcher. */
  | { kind: 'ignore' | 'restore'; files: readonly ScannedFile[] };

export interface ScannedFileFixResult {
  /** The files as stored now. */
  files: ScannedFile[];
  /** Wrong items that were deleted (added by the scanner, no file links to them any more). */
  removedItemIds: string[];
  /** `link`: the copy the files are linked to now. */
  itemId?: string;
  /** `accept`: files left as they were (no suggestion, or its item couldn't be loaded). */
  skipped: number;
}

/** Loads provider items through the gateway (which caches them), keyed by `refKey`. */
async function loadItems(api: ApiClient, refs: readonly ItemRef[]) {
  const items = new Map<string, NormalizedItem>();
  if (refs.length === 0) return items;
  let batch;
  try {
    batch = await api.getItemsBatch(refs);
  } catch (error) {
    throw toCollectionError(error);
  }
  for (const item of batch.items) {
    if (item.provider === 'custom') continue;
    items.set(refKey({ provider: item.provider, externalId: item.externalId }), item);
  }
  return items;
}

async function applyFix(
  { client, api }: CollectionContextValue,
  fix: ScannedFileFix,
): Promise<ScannedFileFixResult> {
  if (fix.kind === 'ignore' || fix.kind === 'restore') {
    const result = await relinkScannedFiles(
      client,
      fix.files.map((file) => file.id),
      { status: fix.kind === 'ignore' ? 'ignored' : 'pending' },
    );
    return { ...result, skipped: 0 };
  }

  if (fix.kind === 'link') {
    const item = (await loadItems(api, [fix.ref])).get(refKey(fix.ref));
    if (!item) {
      throw new CollectionError(
        'provider_unavailable',
        "The item's details couldn't be loaded from its provider.",
      );
    }
    const result = await linkFilesToItem(client, item, fix.files);
    return { ...result, skipped: 0 };
  }

  const { groups, skipped } = topSuggestionGroups(fix.files);
  const items = await loadItems(
    api,
    groups.map((group) => group.ref),
  );
  const result: ScannedFileFixResult = { files: [], removedItemIds: [], skipped: skipped.length };
  for (const group of groups) {
    const item = items.get(refKey(group.ref));
    if (!item) {
      result.skipped += group.files.length;
      continue;
    }
    const linked = await linkFilesToItem(client, item, group.files);
    result.files.push(...linked.files);
    result.removedItemIds.push(...linked.removedItemIds);
  }
  return result;
}

/** Puts written files into the cached lists of their devices (lists that aren't loaded stay so). */
function storeInDeviceLists(queryClient: QueryClient, userId: string, files: ScannedFile[]) {
  const byDevice = new Map<string, ScannedFile[]>();
  for (const file of files)
    byDevice.set(file.deviceId, [...(byDevice.get(file.deviceId) ?? []), file]);
  for (const [deviceId, stored] of byDevice) {
    const key = scannedFilesKey(userId, deviceId);
    if (queryClient.getQueryData(key) === undefined) continue;
    queryClient.setQueryData<ScannedFile[]>(key, (current) =>
      mergeScannedFiles(current ?? [], stored),
    );
  }
}

/**
 * Applies a Fix Match choice (FC-24) for scanned files: link them to an item, accept their top
 * suggestions, ignore them, or hand them back to the matcher. Items that only the files' wrong match
 * created are deleted with it. The device lists update at once; the collection refetches.
 */
export function useFixScannedFiles() {
  const context = useCollectionContext();
  const { userId, onError } = context;
  const queryClient = useQueryClient();
  const mutationKey = collectionMutationKey(userId);

  return useMutation({
    mutationKey,
    mutationFn: (fix: ScannedFileFix) => applyFix(context, fix),
    onSuccess: (result) => {
      storeInDeviceLists(queryClient, userId, result.files);
      for (const id of result.removedItemIds) {
        queryClient.removeQueries({ queryKey: collectionKeys.detail(userId, id) });
      }
      void queryClient.invalidateQueries({ queryKey: itemFileDetailsKeys.all(userId) });
      void queryClient.invalidateQueries({ queryKey: itemScannedFilesKeys.all(userId) });
    },
    onError: (error, fix) => {
      // Part of the fix may be stored (one call per suggestion and per 500 files): reload the lists.
      for (const deviceId of new Set(fix.files.map((file) => file.deviceId))) {
        void queryClient.invalidateQueries({ queryKey: scannedFilesKey(userId, deviceId) });
      }
      void queryClient.invalidateQueries({ queryKey: itemScannedFilesKeys.all(userId) });
      onError?.(toCollectionError(error));
    },
    onSettled: () => {
      // Like the other collection mutations: refetch once the last one has settled.
      if (queryClient.isMutating({ mutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: collectionKeys.all(userId) });
      }
    },
  });
}
