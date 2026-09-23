import { ipcMain } from 'electron';

import { isAppUrl } from './url-policy';
import { IpcChannel } from '../shared/ipc-channels';

import type { IpcMainInvokeEvent } from 'electron';

/** Registers the main-process side of the preload bridge (`window.fanste`). */
export function registerIpcHandlers(appOrigin: string): void {
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

  // The scanner is implemented in FC-21, which also validates the arguments.
  handle(IpcChannel.scannerSelectDirectories, () => notImplemented('scanner.selectDirectories'));
  handle(IpcChannel.scannerStartScan, () => notImplemented('scanner.startScan'));
}

function notImplemented(name: string): never {
  throw new Error(`${name}() is not implemented yet (FC-21)`);
}
