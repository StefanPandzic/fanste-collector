import { describe, expect, it } from 'vitest';

import {
  activeFilterCount,
  DEFAULT_GALLERY_STATE,
  galleryStateUrl,
  parseGalleryState,
  toggleValue,
  withDetailFilter,
} from './gallery-state';

import type { GalleryState } from './gallery-state';

const steelbookTagId = '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f';
const funkoId = '3c9a1e2b-7d4f-4a6b-8c1d-2e3f4a5b6c7d';

const moviesState: GalleryState = {
  filter: {
    category: 'movie',
    ownership: ['owned'],
    formats: ['4K UHD Blu-ray', 'DVD'],
    tagIds: [steelbookTagId],
    acquiredFrom: '2024-01-01',
    search: 'nolan',
    details: { resolution: ['2160p'], audioLanguages: ['en'] },
  },
  sort: 'title_asc',
};

describe('parseGalleryState', () => {
  it('reads the filters and sort from the search params', () => {
    expect(
      parseGalleryState({
        category: 'movie',
        ownership: 'owned',
        format: ['4K UHD Blu-ray', 'DVD'],
        tag: steelbookTagId,
        from: '2024-01-01',
        q: 'nolan',
        resolution: '2160p',
        audio: 'en',
        sort: 'title_asc',
      }),
    ).toEqual(moviesState);
  });

  it('drops invalid values and falls back to the default sort', () => {
    expect(
      parseGalleryState({
        category: 'vhs',
        ownership: ['owned', 'stolen'],
        source: 'import',
        from: '01.05.2024',
        sort: 'price_asc',
      }),
    ).toEqual({ filter: { ownership: ['owned'] }, sort: 'added_desc' });
  });
});

describe('galleryStateUrl', () => {
  it('writes a state that parseGalleryState reads back', () => {
    const url = galleryStateUrl(moviesState);
    expect(url).toContain('format=DVD');
    const params = new URLSearchParams(url.split('?')[1]);
    const raw: Record<string, string[]> = {};
    for (const [key, value] of params) raw[key] = [...(raw[key] ?? []), value];
    expect(parseGalleryState(raw)).toEqual(moviesState);
  });

  it('round-trips the vinyl size and the condition filters', () => {
    const vinylState: GalleryState = {
      filter: {
        category: 'music',
        details: { vinylSize: ['7"'], mediaCondition: ['NM'], sleeveCondition: ['VG+'] },
      },
      sort: 'added_desc',
    };
    const url = galleryStateUrl(vinylState);
    expect(url).toContain('size=7%22');
    expect(url).toContain('media=NM');
    expect(url).toContain('sleeve=VG%2B');
    expect(parseGalleryState(Object.fromEntries(new URLSearchParams(url.split('?')[1])))).toEqual(
      vinylState,
    );
  });

  it('round-trips the platform and storefront filters', () => {
    const gamesState: GalleryState = {
      filter: {
        category: 'video_game',
        details: { platform: ['PlayStation 5'], storefront: ['Steam'] },
      },
      sort: 'added_desc',
    };
    const url = galleryStateUrl(gamesState);
    expect(url).toContain('platform=PlayStation+5');
    expect(url).toContain('store=Steam');
    expect(parseGalleryState(Object.fromEntries(new URLSearchParams(url.split('?')[1])))).toEqual(
      gamesState,
    );
  });

  it('round-trips the release country', () => {
    const ukState: GalleryState = {
      filter: { category: 'music', countries: ['UK', 'Yugoslavia'] },
      sort: 'added_desc',
    };
    const url = galleryStateUrl(ukState);
    expect(url).toContain('country=UK');
    const params = new URLSearchParams(url.split('?')[1]);
    expect(parseGalleryState({ category: 'music', country: params.getAll('country') })).toEqual(
      ukState,
    );
  });

  it('is the bare collection path for the default state', () => {
    expect(galleryStateUrl(DEFAULT_GALLERY_STATE)).toBe('/collection');
  });

  it('round-trips the custom collections on a custom collection page', () => {
    const funkoState: GalleryState = {
      filter: { category: 'custom', customCollectionIds: [funkoId] },
      sort: 'added_desc',
    };
    const url = galleryStateUrl(funkoState, `/collections/${funkoId}`);
    expect(url).toBe(`/collections/${funkoId}?category=custom&collection=${funkoId}`);
    expect(parseGalleryState(Object.fromEntries(new URLSearchParams(url.split('?')[1])))).toEqual(
      funkoState,
    );
  });
});

describe('activeFilterCount', () => {
  it('counts the panel filters but not the category and search', () => {
    expect(activeFilterCount(moviesState.filter)).toBe(6);
    expect(activeFilterCount({ category: 'tv', search: 'breaking' })).toBe(0);
    expect(activeFilterCount({ category: 'music', countries: ['UK'] })).toBe(1);
  });

  it('does not count the custom collections', () => {
    expect(activeFilterCount({ category: 'custom', customCollectionIds: [funkoId] })).toBe(0);
  });
});

describe('toggleValue', () => {
  it('adds a missing value and removes a present one', () => {
    expect(toggleValue(['DVD'], 'Blu-ray')).toEqual(['DVD', 'Blu-ray']);
    expect(toggleValue(['DVD', 'Blu-ray'], 'DVD')).toEqual(['Blu-ray']);
    expect(toggleValue(['DVD'], 'DVD')).toBeUndefined();
  });
});

describe('withDetailFilter', () => {
  it('sets a copy-details filter and drops empty details', () => {
    expect(withDetailFilter({ category: 'movie' }, 'hdr', ['Dolby Vision'])).toEqual({
      category: 'movie',
      details: { hdr: ['Dolby Vision'] },
    });
    expect(withDetailFilter({ details: { hdr: ['HDR10'] } }, 'hdr', undefined)).toEqual({});
  });
});
