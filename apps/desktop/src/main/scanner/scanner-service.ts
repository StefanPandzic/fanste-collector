import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs';
import { promisify } from 'node:util';

import { BrowserWindow, dialog } from 'electron';

import { toPathKey } from '@fanste/core';

import {
  isProbeAllowed,
  parseFolderPath,
  parseProbePaths,
  parseScanOptions,
  resolveScanFolders,
} from './ipc-validation';
import {
  addLibraryFolders,
  readScannerStore,
  removeLibraryFolder,
  writeScannerStore,
} from './library-store';
import { MediaProber } from './media-prober';
import { megabytesToBytes } from './scan-rules';
import createScanWorker from './scan-worker?nodeWorker';
import { IpcChannel } from '../../shared/ipc-channels';

import type { ScannerStore } from './library-store';
import type { ScanWorkerMessage } from './scan-reporter';
import type { ScanWorkerData } from './scan-worker';
import type {
  DesktopOs,
  LibraryFolder,
  MediaProbeResult,
  ScanFileBatch,
  ScanResult,
} from '@fanste/core';
import type { WebContents } from 'electron';

// `realpath.native` returns the real case on Windows and macOS; `fs/promises` has no native variant.
const realpathNative = promisify(realpath.native);

/** The canonical path (real case, links resolved), or the path itself if it can't be resolved. */
async function canonicalPath(folderPath: string): Promise<string> {
  try {
    return await realpathNative(folderPath);
  } catch {
    return folderPath;
  }
}

/**
 * The main-process side of `window.fanste.scanner` (FC-21): the library folders and device ID
 * (`<userData>/scanner.json`), the folder picker, scans, and reading files' media info (FC-22).
 * Scans and probes run on worker threads. Arguments from the renderer are validated here
 * (`ipc-validation.ts`).
 */
export class ScannerService {
  private store: ScannerStore | undefined;
  private running: { scanId: string; cancel: () => void } | undefined;
  private readonly prober = new MediaProber();

  constructor(
    private readonly storePath: string,
    private readonly os: DesktopOs,
  ) {}

  getDeviceId(): string {
    return this.load().deviceId;
  }

  getLibraryFolders(): LibraryFolder[] {
    return this.load().folders;
  }

  async selectDirectories(sender: WebContents): Promise<LibraryFolder[]> {
    const window = BrowserWindow.fromWebContents(sender);
    const options: Electron.OpenDialogOptions = {
      title: 'Add library folders',
      buttonLabel: 'Add folders',
      properties: ['openDirectory', 'multiSelections'],
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return [];

    const folders = await Promise.all(
      result.filePaths.map(async (picked) => {
        const folderPath = await canonicalPath(picked);
        return { path: folderPath, pathKey: toPathKey(folderPath, this.os) };
      }),
    );
    const { store, added } = addLibraryFolders(this.load(), folders, new Date().toISOString());
    this.save(store);
    return added;
  }

  removeLibraryFolder(value: unknown): void {
    const pathKey = toPathKey(parseFolderPath(value, this.os), this.os);
    const store = this.load();
    if (!store.folders.some((folder) => folder.pathKey === pathKey)) {
      throw new Error('The folder is not in the library');
    }
    this.save(removeLibraryFolder(store, pathKey));
  }

  /** Runs a scan, sending its progress and files to `sender`. One scan at a time. */
  async startScan(sender: WebContents, value: unknown): Promise<ScanResult> {
    if (this.running) throw new Error('A scan is already running');
    const options = parseScanOptions(value, this.os);
    // Canonical paths, so a link inside a library folder can't point the scan outside it.
    const requested = options.folders && (await Promise.all(options.folders.map(canonicalPath)));
    // Checked again after the `await`: two calls could both have passed the first check.
    if (this.running) throw new Error('A scan is already running');
    const folders = resolveScanFolders(requested, this.load().folders, this.os);

    const scanId = randomUUID();
    if (folders.length === 0) {
      return { scanId, cancelled: false, completedFolders: [], failedFolders: [], filesFound: 0 };
    }

    const workerData: ScanWorkerData = {
      scanId,
      folders,
      minSizeBytes: megabytesToBytes(options.minFileSizeMb),
      os: this.os,
    };
    const worker = createScanWorker({ workerData });

    return new Promise<ScanResult>((resolve) => {
      const folderResults = new Map<string, boolean>();
      let filesFound = 0;

      const finish = (cancelled: boolean) => {
        if (this.running?.scanId !== scanId) return;
        this.running = undefined;
        sender.off('destroyed', stop);
        sender.off('render-process-gone', stop);
        sender.off('did-start-navigation', onNavigation);
        void worker.terminate();
        resolve({
          scanId,
          cancelled,
          completedFolders: folders.filter((folder) => folderResults.get(folder.pathKey) === true),
          // A folder the worker never finished (it crashed) failed too, unless the user cancelled.
          failedFolders: folders.filter((folder) => {
            const complete = folderResults.get(folder.pathKey);
            return complete === false || (complete === undefined && !cancelled);
          }),
          filesFound,
        });
      };
      // The page that started the scan is gone (closed, crashed or reloaded): stop, so the next page
      // can start its own scan and doesn't get this one's files.
      const stop = () => finish(true);
      const onNavigation = (
        details: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>,
      ) => {
        if (details.isMainFrame && !details.isSameDocument) stop();
      };

      this.running = { scanId, cancel: stop };
      sender.once('destroyed', stop);
      sender.once('render-process-gone', stop);
      sender.on('did-start-navigation', onNavigation);

      worker.on('message', (message: ScanWorkerMessage) => {
        if (this.running?.scanId !== scanId || sender.isDestroyed()) return;
        switch (message.type) {
          case 'progress':
            sender.send(IpcChannel.scannerProgress, message.progress);
            break;
          case 'files': {
            filesFound += message.files.length;
            const batch: ScanFileBatch = {
              scanId,
              files: message.files,
              tooSmallKeys: message.tooSmallKeys,
            };
            sender.send(IpcChannel.scannerFilesFound, batch);
            break;
          }
          case 'folder':
            folderResults.set(message.pathKey, message.complete);
            break;
          case 'done':
            finish(false);
            break;
        }
      });
      worker.on('error', (error: Error) => {
        console.error(`[scanner] The scan worker failed: ${error.message}`);
        finish(false);
      });
      worker.on('exit', () => finish(false));
    });
  }

  cancelScan(): void {
    this.running?.cancel();
  }

  /**
   * Reads the media info of video files inside the library (FC-22). A file that isn't a video in
   * the library isn't read and gets `null`, so one stale path doesn't fail the whole batch.
   */
  async probeFiles(value: unknown): Promise<MediaProbeResult[]> {
    const paths = parseProbePaths(value, this.os);
    // `parseProbePaths` checked these are strings; they are answered as they were passed.
    const requested = value as string[];
    // Canonical paths, so a link inside a library folder can't point the read outside it.
    const canonical = await Promise.all(paths.map(canonicalPath));
    const library = this.load().folders;
    const allowed = canonical.filter((filePath) => isProbeAllowed(filePath, library, this.os));
    const read = allowed.length > 0 ? await this.prober.probe(allowed) : [];
    const results = new Map(allowed.map((filePath, index) => [filePath, read[index] ?? null]));
    return canonical.map((filePath, index) => ({
      path: requested[index] ?? filePath,
      mediaInfo: results.get(filePath) ?? null,
    }));
  }

  private load(): ScannerStore {
    if (!this.store) {
      this.store = readScannerStore(this.storePath, randomUUID);
      // Saved at once, so a new device ID is kept even if nothing else changes.
      writeScannerStore(this.storePath, this.store);
    }
    return this.store;
  }

  private save(store: ScannerStore): void {
    writeScannerStore(this.storePath, store);
    this.store = store;
  }
}
