import { describe, expect, it } from 'vitest';

import {
  cleanDetails,
  copyDetailsSummary,
  copyFieldErrors,
  isEmptyValue,
  parseAmount,
  parseCount,
  platformOptions,
  shownDetails,
  showsCopyDetails,
  showsGameDiscs,
  showsPhysicalGameDetails,
  showsStorefront,
  staleGameFields,
  staleVinylFields,
  showsDigitalStore,
  showsFileFormat,
  showsVinylDetails,
} from './copy-form';

const pc = { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' };
const ps5 = { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' };
const switchPlatform = { id: 130, name: 'Nintendo Switch', abbreviation: 'Switch' };

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

describe('copyDetailsSummary', () => {
  it('describes the copy details of the category', () => {
    expect(copyDetailsSummary('video_game')).toBe('medium, platform, storefront');
    expect(copyDetailsSummary('music')).toBe('medium, pressing, condition');
    expect(copyDetailsSummary('movie')).toBe('medium, quality, languages');
  });
});

describe('showsStorefront', () => {
  it('shows the storefront only for a digital game', () => {
    expect(showsStorefront('Digital')).toBe(true);
    expect(showsStorefront('Digital code')).toBe(true);
    expect(showsStorefront('Disc')).toBe(false);
  });
});

describe('showsGameDiscs', () => {
  it('shows the disc count only for a game on discs', () => {
    expect(showsGameDiscs('Disc')).toBe(true);
    expect(showsGameDiscs('Cartridge')).toBe(false);
  });
});

describe('showsPhysicalGameDetails', () => {
  it('shows the region and completeness for a disc or cartridge', () => {
    expect(showsPhysicalGameDetails('Disc')).toBe(true);
    expect(showsPhysicalGameDetails('Cartridge')).toBe(true);
    expect(showsPhysicalGameDetails('Digital')).toBe(false);
  });
});

describe('staleGameFields', () => {
  it('lists the game details a copy keeps that its medium does not show', () => {
    const details = {
      platform: 'PlayStation 5',
      storefront: 'PlayStation Store',
      discCount: 1,
      region: 'PAL',
      completeness: 'CIB' as const,
    };
    expect(staleGameFields('Digital', details)).toEqual(['discCount', 'region', 'completeness']);
    expect(staleGameFields('Disc', details)).toEqual(['storefront']);
  });
});

describe('platformOptions', () => {
  it('offers the game platforms first and every other platform after', () => {
    expect(platformOptions([pc, ps5], [switchPlatform, pc, ps5])).toEqual({
      options: [
        { value: 'PC (Microsoft Windows)', label: 'PC (Microsoft Windows)' },
        { value: 'PlayStation 5', label: 'PlayStation 5' },
      ],
      more: [{ value: 'Nintendo Switch', label: 'Nintendo Switch' }],
    });
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

  it('keeps the game fields the medium shows', () => {
    const details = { platform: 'PC (Microsoft Windows)', storefront: 'Steam', region: 'PAL' };
    expect(shownDetails('video_game', 'Digital', details)).toEqual({
      platform: 'PC (Microsoft Windows)',
      storefront: 'Steam',
      edition: undefined,
      dlcNotes: undefined,
    });
    expect(shownDetails('video_game', 'Disc', details)).not.toHaveProperty('storefront');
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
