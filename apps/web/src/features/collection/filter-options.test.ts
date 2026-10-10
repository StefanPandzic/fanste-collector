import { describe, expect, it } from 'vitest';

import { filterOptions } from './filter-options';

const resolutions = [
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '2160p', label: '2160p (4K)' },
  { value: '720p', label: '720p (HD)' },
];

describe('filterOptions', () => {
  it('offers all known values while the counts load', () => {
    expect(filterOptions(resolutions, undefined)).toEqual([
      { value: '1080p', label: '1080p (Full HD)', count: undefined },
      { value: '2160p', label: '2160p (4K)', count: undefined },
      { value: '720p', label: '720p (HD)', count: undefined },
    ]);
  });

  it('shows known values with items, then other values by count, then selected leftovers', () => {
    expect(
      filterOptions(
        resolutions,
        { '2160p': 4, '1080p': 9, '576i': 1, '480p': 3 },
        ['720p', 'Betamax'],
        (value) => value.toUpperCase(),
      ),
    ).toEqual([
      { value: '1080p', label: '1080p (Full HD)', count: 9 },
      { value: '2160p', label: '2160p (4K)', count: 4 },
      { value: '720p', label: '720p (HD)', count: 0 },
      { value: '480p', label: '480P', count: 3 },
      { value: '576i', label: '576I', count: 1 },
      { value: 'Betamax', label: 'BETAMAX', count: 0 },
    ]);
  });
});
