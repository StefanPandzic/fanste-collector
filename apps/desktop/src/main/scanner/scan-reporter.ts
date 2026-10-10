import type { ScannedFileInfo, ScanProgress } from '@fanste/core';

/** A message from the scan worker to the main process. */
export type ScanWorkerMessage =
  | { type: 'progress'; progress: ScanProgress }
  | { type: 'files'; files: ScannedFileInfo[]; tooSmallKeys: string[] }
  | { type: 'folder'; pathKey: string; complete: boolean }
  | { type: 'done' };

/** Found files are sent once this many have piled up… */
const BATCH_SIZE = 200;
/** …or this long after the last message, so a slow disk still shows files appearing. */
const FLUSH_INTERVAL_MS = 250;
/** Progress is sent at most this often. */
const PROGRESS_INTERVAL_MS = 100;

export interface ScanReporter {
  directory(path: string): void;
  file(file: ScannedFileInfo): void;
  /** A video on disk that is too small to collect (see `ScanFileBatch.tooSmallKeys`). */
  tooSmall(pathKey: string): void;
  /** Sends what is buffered and the latest progress. */
  flush(): void;
}

/**
 * Batches the walk's events into worker messages (FC-21), so 5,000 files are a few dozen IPC
 * messages instead of 5,000 and the renderer stays responsive.
 */
export function createScanReporter(
  scanId: string,
  post: (message: ScanWorkerMessage) => void,
  now: () => number = Date.now,
): ScanReporter {
  let files: ScannedFileInfo[] = [];
  let tooSmallKeys: string[] = [];
  let filesFound = 0;
  let directoriesScanned = 0;
  let currentDirectory = '';
  let lastFilesAt = now();
  let lastProgressAt = Number.NEGATIVE_INFINITY;

  function sendFiles() {
    if (files.length > 0 || tooSmallKeys.length > 0) post({ type: 'files', files, tooSmallKeys });
    files = [];
    tooSmallKeys = [];
    lastFilesAt = now();
  }

  function sendProgress() {
    post({
      type: 'progress',
      progress: { scanId, filesFound, directoriesScanned, currentDirectory },
    });
    lastProgressAt = now();
  }

  function sendDue() {
    if (
      files.length + tooSmallKeys.length >= BATCH_SIZE ||
      now() - lastFilesAt >= FLUSH_INTERVAL_MS
    )
      sendFiles();
    if (now() - lastProgressAt >= PROGRESS_INTERVAL_MS) sendProgress();
  }

  return {
    directory(path) {
      currentDirectory = path;
      directoriesScanned += 1;
      sendDue();
    },
    file(file) {
      files.push(file);
      filesFound += 1;
      sendDue();
    },
    tooSmall(pathKey) {
      tooSmallKeys.push(pathKey);
      sendDue();
    },
    flush() {
      sendFiles();
      sendProgress();
    },
  };
}
