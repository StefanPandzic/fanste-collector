import { describe, expect, it } from 'vitest';

import {
  cleanDetails,
  copyFieldErrors,
  isEmptyValue,
  parseAmount,
  parseCount,
  showsCopyDetails,
  showsDigitalStore,
  showsFileFormat,
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
