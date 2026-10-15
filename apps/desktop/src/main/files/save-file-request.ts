import path from 'node:path';

import type { SaveFileRequest, SaveFileType } from '@fanste/core';

// Validation of `window.fanste.files.saveFile` requests (FC-25). The renderer is treated as a remote
// page: it picks the suggested name, type and content, never the path.

/** Largest file the renderer may ask to save. */
export const MAX_SAVE_FILE_BYTES = 100 * 1024 * 1024;

const MAX_NAME_LENGTH = 120;

/** The Save dialog's filter of each file type. */
export const SAVE_FILE_FILTERS: Record<SaveFileType, { name: string; extensions: string[] }> = {
  csv: { name: 'CSV file', extensions: ['csv'] },
  zip: { name: 'ZIP archive', extensions: ['zip'] },
  pdf: { name: 'PDF document', extensions: ['pdf'] },
};

function isSaveFileType(value: unknown): value is SaveFileType {
  return typeof value === 'string' && Object.hasOwn(SAVE_FILE_FILTERS, value);
}

/**
 * A plain file name for the dialog: no folders, no characters Windows or macOS reject, and the
 * type's extension.
 */
export function safeFileName(name: string, type: SaveFileType): string {
  const base = path.win32
    .basename(path.posix.basename(name))
    // Control characters and the others Windows doesn't allow (folders are gone after `basename`).
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"|?*]/g, '-')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_NAME_LENGTH);
  const stem = base.toLowerCase().endsWith(`.${type}`) ? base.slice(0, -(type.length + 1)) : base;
  return `${stem || 'export'}.${type}`;
}

/** Bytes of the content: the length of a byte array, or of the text as UTF-8. */
function byteLength(data: string | Uint8Array): number {
  return typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : data.byteLength;
}

/** Checks a save request from the renderer and returns it with a safe file name; throws if invalid. */
export function parseSaveFileRequest(value: unknown): SaveFileRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid save request');
  const { defaultName, type, data } = value as Record<string, unknown>;
  if (!isSaveFileType(type)) throw new Error('Unsupported file type');
  if (typeof defaultName !== 'string') throw new Error('Invalid file name');
  if (typeof data !== 'string' && !(data instanceof Uint8Array)) {
    throw new Error('Invalid file content');
  }
  if (byteLength(data) > MAX_SAVE_FILE_BYTES) throw new Error('The file is too large');
  return { defaultName: safeFileName(defaultName, type), type, data };
}
