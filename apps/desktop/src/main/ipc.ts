import { ipcMain, nativeTheme } from 'electron';

import { parseDesktopTheme } from './title-bar';
import { isAppUrl } from './url-policy';
import { IpcChannel } from '../shared/ipc-channels';

import type { ScannerService } from './scanner/scanner-service';
import type { IpcMainInvokeEvent } from 'electron';

/** Registers the main-process side of the preload bridge (`window.fanste`). */
export function registerIpcHandlers(appOrigin: string, scanner: ScannerService): void {
  /** Like `ipcMain.handle`, but rejects calls from frames that aren't on the app origin. */
  function handle(
    channel: string,
    listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
  ) {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isAppUrl(event.senderFrame?.url ?? '', appOrigin)) {
        throw new Error(`Blocked "${channel}" call from an untrusted frame`);
      }
      return listener(event, ...args);
    });
  }

  // `ScannerService` validates the arguments.
  handle(IpcChannel.scannerGetDeviceId, () => scanner.getDeviceId());
  handle(IpcChannel.scannerGetLibraryFolders, () => scanner.getLibraryFolders());
  handle(IpcChannel.scannerSelectDirectories, (event) => scanner.selectDirectories(event.sender));
  handle(IpcChannel.scannerRemoveLibraryFolder, (_event, folderPath) =>
    scanner.removeLibraryFolder(folderPath),
  );
  handle(IpcChannel.scannerStartScan, (event, options) => scanner.startScan(event.sender, options));
  handle(IpcChannel.scannerCancelScan, () => scanner.cancelScan());
  handle(IpcChannel.scannerProbeFiles, (_event, paths) => scanner.probeFiles(paths));

  // `window.ts` listens for the resulting `nativeTheme` update and recolors the window chrome.
  handle(IpcChannel.windowSetTheme, (_event, theme) => {
    nativeTheme.themeSource = parseDesktopTheme(theme);
  });
}
