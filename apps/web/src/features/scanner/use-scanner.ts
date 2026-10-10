'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { collectionErrorMessage, useScannedFiles, useScannedFileSync } from '@fanste/collection';

import { keysKeptByFolders, loadMinSize, MIN_SIZE_STORAGE_KEY, scanSummary } from './scanner-view';

import type { DesktopScannerApi, LibraryFolder, ScanProgress } from '@fanste/core';

/** The desktop scanner bridge, or `undefined` in a browser or a desktop build older than FC-21. */
function scannerBridge(): DesktopScannerApi | undefined {
  const scanner = typeof window === 'undefined' ? undefined : window.fanste?.scanner;
  // Desktop builds before FC-21 only had stubs; the web app can be newer than the desktop app.
  return typeof scanner?.getDeviceId === 'function' ? scanner : undefined;
}

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const foldersKey = ['desktop-scanner', 'folders'] as const;

export type ScanPhase =
  /** Nothing running. */
  | { kind: 'idle' }
  /** The desktop app is walking the folders. */
  | { kind: 'scanning'; progress: ScanProgress | undefined; cancelling: boolean }
  /** The walk is done; the last batches are being written. */
  | { kind: 'saving'; filesFound: number };

/**
 * The scanner page's state and actions (FC-21): the library folders and device ID from the desktop
 * app, the device's scanned files, and scans. Found files are written in batches as they arrive,
 * only new or changed ones (`useScannedFileSync`); when the scan is done, files that are gone from
 * the completed folders are marked as removed.
 */
export function useScanner() {
  const [scanner] = useState(scannerBridge);
  const queryClient = useQueryClient();

  const deviceId = useQuery({
    queryKey: ['desktop-scanner', 'device-id'],
    queryFn: () => scanner!.getDeviceId(),
    enabled: scanner !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const folders = useQuery({
    queryKey: foldersKey,
    queryFn: () => scanner!.getLibraryFolders(),
    enabled: scanner !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const files = useScannedFiles(deviceId.data);
  const sync = useScannedFileSync(deviceId.data);

  const [phase, setPhase] = useState<ScanPhase>({ kind: 'idle' });
  const running = useRef(false);
  const [minSizeMb, setMinSizeState] = useState(() => loadMinSize(browserStorage()));

  const setMinSizeMb = useCallback((value: number) => {
    setMinSizeState(value);
    try {
      browserStorage()?.setItem(MIN_SIZE_STORAGE_KEY, String(value));
    } catch {
      // Storage unavailable: the choice lasts until the page is left.
    }
  }, []);

  // A scan doesn't outlive the page: leaving it stops the walk (what was written stays).
  useEffect(
    () => () => {
      if (running.current) void scanner?.cancelScan();
    },
    [scanner],
  );

  /** Scans the given library folders (or folders inside them), or the whole library. */
  const scan = useCallback(
    async (scanFolders?: readonly string[]) => {
      if (!scanner || running.current || !files.data) return;
      running.current = true;
      setPhase({ kind: 'scanning', progress: undefined, cancelling: false });

      const seen = new Set<string>();
      let received = 0;
      let written = 0;
      let writeError: unknown;
      let writes = Promise.resolve();

      // Only one scan runs at a time, and only this page starts one, so every batch is ours.
      const stopFiles = scanner.onFilesFound(({ files: batch, tooSmallKeys }) => {
        received += batch.length;
        for (const file of batch) seen.add(file.pathKey);
        // Too small for this scan, but still on disk: not removed.
        for (const key of tooSmallKeys ?? []) seen.add(key);
        writes = writes
          .then(() => sync.syncBatch(batch))
          .then((count) => {
            written += count;
          })
          .catch((error: unknown) => {
            writeError ??= error;
          });
      });
      const stopProgress = scanner.onScanProgress((progress) =>
        setPhase((current) => (current.kind === 'scanning' ? { ...current, progress } : current)),
      );

      try {
        const result = await scanner.startScan({
          ...(scanFolders ? { folders: scanFolders } : {}),
          minFileSizeMb: minSizeMb,
        });
        setPhase({ kind: 'saving', filesFound: result.filesFound });
        await writes;

        let removed = 0;
        // Files are marked as gone only when every found file was written: otherwise a file that
        // failed to save would count as missing.
        if (writeError === undefined && received === result.filesFound) {
          removed = await sync.markMissing(
            seen,
            result.completedFolders.map((folder) => folder.pathKey),
          );
        }

        if (writeError !== undefined) {
          toast.error(`Some files couldn't be saved. ${collectionErrorMessage(writeError)}`);
        } else if (result.cancelled) {
          toast.info(`Scan stopped. ${scanSummary({ found: received, written, removed })}`);
        } else {
          toast.success(scanSummary({ found: result.filesFound, written, removed }));
        }
        if (result.failedFolders.length > 0) {
          toast.warning(
            `Couldn't read all of ${result.failedFolders.map((folder) => folder.path).join(', ')}. ` +
              'Check that the drive is connected.',
          );
        }
      } catch (error) {
        toast.error(`The scan failed. ${collectionErrorMessage(error)}`);
      } finally {
        stopFiles();
        stopProgress();
        running.current = false;
        setPhase({ kind: 'idle' });
      }
    },
    [files.data, minSizeMb, scanner, sync],
  );

  const cancel = useCallback(() => {
    setPhase((current) =>
      current.kind === 'scanning' ? { ...current, cancelling: true } : current,
    );
    void scanner?.cancelScan();
  }, [scanner]);

  /** Opens the folder picker, then scans the added folders. */
  const addFolders = useCallback(async () => {
    if (!scanner) return;
    try {
      const added = await scanner.selectDirectories();
      if (added.length === 0) return;
      queryClient.setQueryData<LibraryFolder[]>(foldersKey, (current) => [
        ...(current ?? []),
        ...added,
      ]);
      await scan(added.map((folder) => folder.path));
    } catch {
      toast.error("The folders couldn't be added. Try again.");
    }
  }, [queryClient, scan, scanner]);

  /** Takes a folder out of the library and marks its files as removed. */
  const removeFolder = useCallback(
    async (folder: LibraryFolder) => {
      if (!scanner || running.current) return;
      try {
        await scanner.removeLibraryFolder(folder.path);
      } catch {
        toast.error("The folder couldn't be removed. Try again.");
        void queryClient.invalidateQueries({ queryKey: foldersKey });
        return;
      }
      const remaining = (folders.data ?? []).filter((other) => other.pathKey !== folder.pathKey);
      queryClient.setQueryData<LibraryFolder[]>(foldersKey, remaining);
      try {
        // `files.data` is loaded: the page only shows the folders once it is.
        await sync.markMissing(keysKeptByFolders(files.data ?? [], remaining), [folder.pathKey]);
        toast.success('Folder removed from the library.');
      } catch (error) {
        toast.error(
          `The folder was removed, but its videos are still listed. ${collectionErrorMessage(error)}`,
        );
      }
    },
    [files.data, folders.data, queryClient, scanner, sync],
  );

  return {
    /** `false` in a desktop app too old for the scanner. */
    supported: scanner !== undefined,
    deviceId,
    folders,
    files,
    phase,
    minSizeMb,
    setMinSizeMb,
    scan,
    cancel,
    addFolders,
    removeFolder,
  };
}
