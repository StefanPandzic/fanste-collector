import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { useCollectionContext } from './context';
import {
  collectionKeys,
  itemFileDetailsKeys,
  itemScannedFilesKeys,
  scannedFilesKey,
  scannerSettingsKey,
} from './query-keys';
import { toCollectionError } from '../errors';
import { getScannerSettings, saveScannerSettings } from '../repository/scan-matching';
import { mergeScannedFiles } from '../repository/scanned-files';
import { createScanMatchRunner } from '../scanner/match-runner';

import type { CollectionContextValue } from './context';
import type { ScannedFile } from '../repository/scanned-files';
import type { ScanMatchProgress, ScanMatchSummary } from '../scanner/match-runner';
import type { ScannerSettings } from '@fanste/core';

function scannerSettingsQuery(client: CollectionContextValue['client'], userId: string) {
  return {
    queryKey: scannerSettingsKey(userId),
    queryFn: () => getScannerSettings(client),
    staleTime: 5 * 60 * 1000,
  };
}

/** The user's scanner settings (FC-23), with defaults filled in. */
export function useScannerSettings() {
  const { client, userId } = useCollectionContext();
  return useQuery(scannerSettingsQuery(client, userId));
}

/** Saves the scanner settings; the cached value changes at once and rolls back on error. */
export function useSaveScannerSettings() {
  const { client, userId, onError } = useCollectionContext();
  const queryClient = useQueryClient();
  const key = scannerSettingsKey(userId);
  return useMutation({
    mutationFn: (settings: ScannerSettings) => saveScannerSettings(client, settings),
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ScannerSettings>(key);
      queryClient.setQueryData(key, settings);
      return { previous };
    },
    onError: (error, _settings, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      onError?.(toCollectionError(error));
    },
  });
}

/** The files of a device that wait for matching: `pending` and still on disk. */
export function pendingMatchFiles(files: readonly ScannedFile[]): ScannedFile[] {
  return files.filter((file) => file.matchStatus === 'pending' && file.removedAt === null);
}

export interface ScanMatcher {
  progress: ScanMatchProgress;
  /** Matches the device's pending files (or runs again after the current run). */
  start: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * The background matcher of a device's scanned files (FC-23), over the cached list of
 * `useScannedFiles` (load it first). Results go into that list; added copies refresh the
 * collection. Stops when the component unmounts or the device changes.
 *
 * @param onFinished Called when a run ends, e.g. for the "Added 132 items, 18 need review" toast.
 */
export function useScanMatcher(
  deviceId: string | undefined,
  onFinished: (summary: ScanMatchSummary) => void,
): ScanMatcher {
  const { client, api, userId } = useCollectionContext();
  const queryClient = useQueryClient();
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  const runner = useMemo(() => {
    const filesKey = scannedFilesKey(userId, deviceId ?? '');
    return createScanMatchRunner({
      client,
      api,
      pendingFiles: () =>
        deviceId ? pendingMatchFiles(queryClient.getQueryData<ScannedFile[]>(filesKey) ?? []) : [],
      settings: () => queryClient.fetchQuery(scannerSettingsQuery(client, userId)),
      onFilesStored: (stored) =>
        queryClient.setQueryData<ScannedFile[]>(filesKey, (files) =>
          mergeScannedFiles(files ?? [], stored),
        ),
      onCollectionChanged: () => {
        void queryClient.invalidateQueries({ queryKey: collectionKeys.all(userId) });
        void queryClient.invalidateQueries({ queryKey: itemFileDetailsKeys.all(userId) });
        void queryClient.invalidateQueries({ queryKey: itemScannedFilesKeys.all(userId) });
      },
    });
  }, [api, client, deviceId, queryClient, userId]);

  useEffect(() => {
    const unsubscribe = runner.onFinished((summary) => finished.current(summary));
    return () => {
      unsubscribe();
      runner.stop();
    };
  }, [runner]);

  const progress = useSyncExternalStore(runner.subscribe, runner.getProgress, runner.getProgress);
  return useMemo(
    () => ({ progress, start: runner.start, pause: runner.pause, resume: runner.resume }),
    [progress, runner],
  );
}
