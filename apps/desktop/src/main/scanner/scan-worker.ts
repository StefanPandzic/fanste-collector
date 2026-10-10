/**
 * Scan worker (FC-21): walks the library folders on a worker thread, so a large library never
 * blocks the main process (and with it the window). Started by `scanner-service.ts` through
 * electron-vite's `?nodeWorker` import; stopping a scan terminates the thread.
 */
import { parentPort, workerData } from 'node:worker_threads';

import { createScanReporter } from './scan-reporter';
import { walkLibraryFolder } from './walk';

import type { ScanReporter, ScanWorkerMessage } from './scan-reporter';
import type { DesktopOs, ScannedFolder } from '@fanste/core';

export interface ScanWorkerData {
  scanId: string;
  folders: ScannedFolder[];
  minSizeBytes: number;
  os: DesktopOs;
}

const data = workerData as ScanWorkerData;
const post = (message: ScanWorkerMessage) => parentPort?.postMessage(message);

async function scan(reporter: ScanReporter): Promise<void> {
  for (const folder of data.folders) {
    let complete = false;
    try {
      ({ complete } = await walkLibraryFolder(folder.path, {
        minSizeBytes: data.minSizeBytes,
        os: data.os,
        onDirectory: (directory) => reporter.directory(directory),
        onFile: (file) => reporter.file(file),
        onTooSmall: (pathKey) => reporter.tooSmall(pathKey),
      }));
    } catch {
      // The folder itself is unreadable (e.g. an unplugged drive): reported as not complete.
    }
    // The folder's files go out before the folder counts as done.
    reporter.flush();
    post({ type: 'folder', pathKey: folder.pathKey, complete });
  }
  post({ type: 'done' });
}

void scan(createScanReporter(data.scanId, post));
