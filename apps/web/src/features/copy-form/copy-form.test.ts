import { describe, expect, it } from 'vitest';

import {
  cleanDetails,
  copyFieldErrors,
  isEmptyValue,
  parseAmount,
  parseCount,
  shownDetails,
  showsCopyDetails,
  staleVinylFields,
  showsDigitalStore,
  showsFileFormat,
  showsVinylDetails,
} from './copy-form';

describe('showsCopyDetails', () => {
  it('shows details for copies the user has', () => {
    expect(showsCopyDetails('owned')).toBe(true);
    expect(showsCopyDetails('loaned_out')).toBe(true);
    expect(showsCopyDetails('wishlist')).toBe(false);
  });
});

describe('showsFileFormat', () => {
  it('shows the container only for a digital file', () => {
    expect(showsFileFormat('Digital file')).toBe(true);
    expect(showsFileFormat('Blu-ray')).toBe(false);
  });
});

describe('showsDigitalStore', () => {
  it('shows the store only for a digital store copy', () => {
    expect(showsDigitalStore('Digital store')).toBe(true);
    expect(showsDigitalStore('Digital file')).toBe(false);
  });
});

describe('showsVinylDetails', () => {
  it('shows the record details only for vinyl', () => {
    expect(showsVinylDetails('Vinyl')).toBe(true);
    expect(showsVinylDetails('CD')).toBe(false);
  });
});

describe('shownDetails', () => {
  it('keeps the music fields the medium shows', () => {
    const details = { vinylSize: '7"', speed: '45', catalogNumber: 'R 5084', resolution: '1080p' };
    expect(shownDetails('music', 'Vinyl', details)).toEqual({
      discCount: undefined,
      vinylSize: '7"',
      speed: '45',
      variant: undefined,
      catalogNumber: 'R 5084',
      mediaCondition: undefined,
      sleeveCondition: undefined,
    });
    expect(shownDetails('music', 'Cassette', details)).not.toHaveProperty('speed');
  });

  it('keeps the file format of a movie only for a digital file', () => {
    expect(shownDetails('movie', 'Blu-ray', { resolution: '1080p', fileFormat: 'MKV' })).toEqual({
      resolution: '1080p',
    });
    expect(shownDetails('movie', 'Digital file', { fileFormat: 'MKV' })).toEqual({
      fileFormat: 'MKV',
    });
  });
});

describe('isEmptyValue', () => {
  it('treats blank text, empty lists and missing values as not set', () => {
    expect(isEmptyValue('  ')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue('Steelbook')).toBe(false);
    expect(isEmptyValue(2)).toBe(false);
  });
});

describe('cleanDetails', () => {
  it('drops blank text, empty lists and undefined values', () => {
    expect(
      cleanDetails({
        resolution: '2160p',
        edition: '  ',
        subtitleLanguages: [],
        region: undefined,
        discCount: 2,
      }),
    ).toEqual({ resolution: '2160p', discCount: 2 });
  });
});

describe('parseAmount', () => {
  it('reads amounts with a dot or a comma', () => {
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount(' ')).toBe(null);
    expect(parseAmount('12.345')).toBeNaN();
  });
});

describe('parseCount', () => {
  it('reads whole numbers', () => {
    expect(parseCount('3')).toBe(3);
    expect(parseCount('1.5')).toBeNaN();
  });
});

describe('copyFieldErrors', () => {
  it('maps issue paths to field messages', () => {
    expect(copyFieldErrors([{ path: ['quantity'] }, { path: ['details', 'discCount'] }])).toEqual({
      quantity: 'Enter a whole number from 1 to 9999.',
      'details.discCount': 'Enter a number of discs from 1 to 99.',
    });
  });
});

describe('staleVinylFields', () => {
  it('lists the vinyl details a copy keeps once its medium is not vinyl', () => {
    const details = { vinylSize: '12"', speed: '33⅓', catalogNumber: 'PCS 7088' };
    expect(staleVinylFields('CD', details)).toEqual(['vinylSize', 'speed']);
    expect(staleVinylFields('Vinyl', details)).toEqual([]);
  });
});
