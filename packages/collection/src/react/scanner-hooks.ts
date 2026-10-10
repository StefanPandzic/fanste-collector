import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { findRemovedFiles, planScannedFileUpserts } from '@fanste/core';

import { useCollectionContext } from './context';
import { scannedFilesKey } from './query-keys';
import {
  listScannedFiles,
  markRemovedInList,
  markScannedFilesRemoved,
  mergeScannedFiles,
  upsertScannedFiles,
} from '../repository/scanned-files';

import type { ScannedFile } from '../repository/scanned-files';
import type { ScannedFileInfo } from '@fanste/core';

/**
 * Every scanned file of this device (FC-21), removed ones included; filter on `removedAt` to show
 * the current ones. Only this device writes them, so they aren't refetched on focus.
 */
export function useScannedFiles(deviceId: string | undefined) {
  const { client, userId } = useCollectionContext();
  return useQuery({
    queryKey: scannedFilesKey(userId, deviceId ?? ''),
    queryFn: () => listScannedFiles(client, deviceId ?? ''),
    enabled: deviceId !== undefined,
    staleTime: 5 * 60 * 1000,
    // A refetch during a scan could land after a batch and briefly show older rows.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export interface ScannedFileSync {
  /**
   * Writes the new and changed files of a scan batch and adds them to the cached list. Call it for
   * one batch at a time, in order, after `useScannedFiles` has loaded. Resolves to the rows written.
   */
  syncBatch(found: readonly ScannedFileInfo[]): Promise<number>;
  /**
   * Marks the files inside `rootKeys` that aren't in `seenKeys` as removed. After a scan, pass the
   * completed folders; for a folder taken out of the library, pass it with no seen keys.
   * Resolves to the number of files marked.
   */
  markMissing(seenKeys: ReadonlySet<string>, rootKeys: readonly string[]): Promise<number>;
}

/**
 * Writes scan results to `scanned_files` (FC-21). Only new and changed files are written
 * (`planScannedFileUpserts`), which is what keeps a re-scan of a large library quick. Errors are
 * thrown as `CollectionError`s.
 */
export function useScannedFileSync(deviceId: string | undefined): ScannedFileSync {
  const { client, userId } = useCollectionContext();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const key = scannedFilesKey(userId, deviceId ?? '');
    const cached = () => queryClient.getQueryData<ScannedFile[]>(key);
    const requireDevice = () => {
      if (!deviceId || !cached()) throw new Error('Load the scanned files first.');
      return deviceId;
    };

    return {
      async syncBatch(found) {
        const device = requireDevice();
        const known = new Map((cached() ?? []).map((file) => [file.pathKey, file]));
        const upserts = planScannedFileUpserts(known, found);
        if (upserts.length === 0) return 0;
        const stored = await upsertScannedFiles(client, device, upserts);
        queryClient.setQueryData<ScannedFile[]>(key, (files) =>
          mergeScannedFiles(files ?? [], stored),
        );
        return stored.length;
      },
      async markMissing(seenKeys, rootKeys) {
        requireDevice();
        const ids = findRemovedFiles(cached() ?? [], seenKeys, rootKeys);
        if (ids.length === 0) return 0;
        const removedAt = await markScannedFilesRemoved(client, ids);
        queryClient.setQueryData<ScannedFile[]>(key, (files) =>
          markRemovedInList(files ?? [], ids, removedAt),
        );
        return ids.length;
      },
    };
  }, [client, deviceId, queryClient, userId]);
}
