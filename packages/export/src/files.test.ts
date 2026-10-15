import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { buildZip, exportFileName, fileSlug, localIsoDate, uniqueFileNames } from './files';

const exportDate = new Date(2026, 9, 5, 23, 30);

describe('localIsoDate', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    expect(localIsoDate(exportDate)).toBe('2026-10-05');
  });
});

describe('exportFileName', () => {
  it('names the file after the date', () => {
    expect(exportFileName(exportDate, 'csv')).toBe('fanste-collection-2026-10-05.csv');
    expect(exportFileName(exportDate, 'zip')).toBe('fanste-collection-2026-10-05.zip');
  });
});

describe('fileSlug', () => {
  it('turns a label into a file-name-safe slug', () => {
    expect(fileSlug('Video Games')).toBe('video-games');
    expect(fileSlug('Funko Pops / Marvel')).toBe('funko-pops-marvel');
    expect(fileSlug('Pokémon cards')).toBe('pokemon-cards');
  });
});

describe('uniqueFileNames', () => {
  it('numbers repeated names', () => {
    expect(uniqueFileNames(['Movies', 'Funko Pops', 'Funko pops!'], 'csv')).toEqual([
      'movies.csv',
      'funko-pops.csv',
      'funko-pops-2.csv',
    ]);
  });
});

describe('buildZip', () => {
  it('packs the text files into a ZIP archive', () => {
    const zip = buildZip([
      { name: 'movies.csv', content: 'Title\r\nInception' },
      { name: 'music.csv', content: 'Title\r\nAbbey Road' },
    ]);
    const files = unzipSync(zip);
    expect(Object.keys(files)).toEqual(['movies.csv', 'music.csv']);
    expect(strFromU8(files['movies.csv'] ?? new Uint8Array())).toBe('Title\r\nInception');
    expect(strFromU8(files['music.csv'] ?? new Uint8Array())).toBe('Title\r\nAbbey Road');
  });
});
