/**
 * Preload script: runs in the sandboxed renderer before the web app and exposes `window.fanste`.
 * Only the functions below cross the bridge; `ipcRenderer` and Node.js APIs are never exposed.
 * See `FansteDesktopBridge` in `@fanste/core` for the contract.
 */
import { contextBridge, ipcRenderer } from 'electron';

import { IpcChannel } from '../shared/ipc-channels';
import { toDesktopOs } from '../shared/platform';

import type {
  FansteDesktopBridge,
  LibraryFolder,
  MediaProbeResult,
  ScanFileBatch,
  ScanProgress,
  ScanResult,
} from '@fanste/core';
import type { IpcRendererEvent } from 'electron';

/** Listens to a main → renderer event. Returns a function that removes the listener. */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  // Wrapped so the renderer never receives the `IpcRendererEvent` (it exposes `ipcRenderer`).
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: FansteDesktopBridge = {
  platform: {
    os: toDesktopOs(process.platform),
    appVersion: __APP_VERSION__,
  },
  scanner: {
    getDeviceId: () => ipcRenderer.invoke(IpcChannel.scannerGetDeviceId) as Promise<string>,
    getLibraryFolders: () =>
      ipcRenderer.invoke(IpcChannel.scannerGetLibraryFolders) as Promise<LibraryFolder[]>,
    selectDirectories: () =>
      ipcRenderer.invoke(IpcChannel.scannerSelectDirectories) as Promise<LibraryFolder[]>,
    removeLibraryFolder: (path) =>
      ipcRenderer.invoke(IpcChannel.scannerRemoveLibraryFolder, path) as Promise<void>,
    startScan: (options) =>
      ipcRenderer.invoke(IpcChannel.scannerStartScan, options) as Promise<ScanResult>,
    cancelScan: () => ipcRenderer.invoke(IpcChannel.scannerCancelScan) as Promise<void>,
    onScanProgress: (listener) => subscribe<ScanProgress>(IpcChannel.scannerProgress, listener),
    onFilesFound: (listener) => subscribe<ScanFileBatch>(IpcChannel.scannerFilesFound, listener),
    probeFiles: (paths) =>
      ipcRenderer.invoke(IpcChannel.scannerProbeFiles, paths) as Promise<MediaProbeResult[]>,
  },
  window: {
    setTheme: (theme) => ipcRenderer.invoke(IpcChannel.windowSetTheme, theme) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('fanste', bridge);
