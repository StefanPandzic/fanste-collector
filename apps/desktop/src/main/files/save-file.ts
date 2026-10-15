import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { app, BrowserWindow, dialog } from 'electron';

import { parseSaveFileRequest, SAVE_FILE_FILTERS } from './save-file-request';

import type { SaveFileResult } from '@fanste/core';
import type { WebContents } from 'electron';

/**
 * Shows the native Save dialog for a file the web app built (an export, FC-25) and writes it to the
 * picked path. The dialog starts in the Downloads folder.
 */
export async function saveFile(sender: WebContents, request: unknown): Promise<SaveFileResult> {
  const { defaultName, type, data } = parseSaveFileRequest(request);
  const options: Electron.SaveDialogOptions = {
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [SAVE_FILE_FILTERS[type]],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  };
  const window = BrowserWindow.fromWebContents(sender);
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { saved: false };
  await writeFile(result.filePath, data);
  return { saved: true };
}
