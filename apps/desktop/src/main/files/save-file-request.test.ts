import { describe, expect, it } from 'vitest';

import { MAX_SAVE_FILE_BYTES, parseSaveFileRequest, safeFileName } from './save-file-request';

const csvName = 'fanste-collection-2026-10-15.csv';

describe('safeFileName', () => {
  it('keeps a plain name with the right extension', () => {
    expect(safeFileName(csvName, 'csv')).toBe(csvName);
  });

  it('strips folders, replaces bad characters and enforces the extension', () => {
    expect(safeFileName('C:\\Users\\Public\\Desktop\\export.csv', 'csv')).toBe('export.csv');
    expect(safeFileName('../../etc/passwd', 'zip')).toBe('passwd.zip');
    expect(safeFileName('movies: "best" <4K>?.csv', 'csv')).toBe('movies- -best- -4K--.csv');
    expect(safeFileName('collection.csv', 'zip')).toBe('collection.csv.zip');
  });
});

describe('parseSaveFileRequest', () => {
  it('accepts text or bytes and returns a safe name', () => {
    expect(
      parseSaveFileRequest({ defaultName: 'C:\\Temp\\' + csvName, type: 'csv', data: 'Title' }),
    ).toEqual({ defaultName: csvName, type: 'csv', data: 'Title' });
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(parseSaveFileRequest({ defaultName: 'export.zip', type: 'zip', data: zip }).data).toBe(
      zip,
    );
  });

  it('rejects invalid requests', () => {
    expect(() => parseSaveFileRequest({ defaultName: 'run.exe', type: 'exe', data: '' })).toThrow(
      /Unsupported file type/,
    );
    expect(() => parseSaveFileRequest({ defaultName: 42, type: 'csv', data: '' })).toThrow(
      /Invalid file name/,
    );
    expect(() => parseSaveFileRequest({ defaultName: csvName, type: 'csv', data: [1, 2] })).toThrow(
      /Invalid file content/,
    );
    expect(() =>
      parseSaveFileRequest({
        defaultName: csvName,
        type: 'csv',
        data: new Uint8Array(MAX_SAVE_FILE_BYTES + 1),
      }),
    ).toThrow(/too large/);
  });
});
