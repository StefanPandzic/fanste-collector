/**
 * Preload script: runs in the sandboxed renderer before the web app and exposes `window.fanste`.
 * Only the functions below cross the bridge; `ipcRenderer` and Node.js APIs are never exposed.
 * See `FansteDesktopBridge` in `@fanste/core` for the contract.
 */
import { contextBridge, ipcRenderer } from 'electron';

import { IpcChannel } from '../shared/ipc-channels';
import { toDesktopOs } from '../shared/platform';

import type { FansteDesktopBridge, ScanProgress } from '@fanste/core';
import type { IpcRendererEvent } from 'electron';

const bridge: FansteDesktopBridge = {
  platform: {
    os: toDesktopOs(process.platform),
    appVersion: __APP_VERSION__,
  },
  scanner: {
    selectDirectories: () =>
      ipcRenderer.invoke(IpcChannel.scannerSelectDirectories) as Promise<string[]>,
    startScan: (directories) =>
      ipcRenderer.invoke(IpcChannel.scannerStartScan, directories) as Promise<void>,
    onScanProgress: (listener) => {
      // Wrapped so the renderer never receives the `IpcRendererEvent` (it exposes `ipcRenderer`).
      const handler = (_event: IpcRendererEvent, progress: ScanProgress) => listener(progress);
      ipcRenderer.on(IpcChannel.scannerProgress, handler);
      return () => {
        ipcRenderer.removeListener(IpcChannel.scannerProgress, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('fanste', bridge);
