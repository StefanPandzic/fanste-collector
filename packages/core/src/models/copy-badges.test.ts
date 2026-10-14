import { describe, expect, it } from 'vitest';

import { copyBadges } from './copy-badges';

import type { TvExtra } from './extras';

const breakingBadExtra: TvExtra = {
  seasons: [
    { seasonNumber: 1, name: 'Season 1', episodeCount: 7, airYear: 2008 },
    { seasonNumber: 2, name: 'Season 2', episodeCount: 13, airYear: 2009 },
  ],
};

describe('copyBadges', () => {
  it('lists the medium, resolution, HDR, edition and discs of a movie copy', () => {
    expect(
      copyBadges('movie', '4K UHD Blu-ray', {
        resolution: '2160p',
        hdr: 'Dolby Vision',
        edition: 'Steelbook',
        discCount: 2,
      }),
    ).toEqual(['4K UHD', 'Dolby Vision', 'Steelbook', '2 discs']);
    expect(
      copyBadges('movie', 'Blu-ray', {
        resolution: '2160p',
        hdr: 'none',
        edition: 'Standard',
        discCount: 1,
      }),
    ).toEqual(['Blu-ray', '4K']);
    expect(copyBadges('movie', 'Digital file', { fileFormat: 'MKV', resolution: '1080p' })).toEqual(
      ['MKV', '1080p'],
    );
  });

  it('adds the owned seasons of a TV copy', () => {
    expect(
      copyBadges(
        'tv',
        'Blu-ray',
        {
          seasons: [
            { seasonNumber: 1, episodesOwned: 'all' },
            { seasonNumber: 2, episodesOwned: [1, 2, 3, 4] },
          ],
        },
        breakingBadExtra,
      ),
    ).toEqual(['Blu-ray', '1 full season + 4 episodes']);
  });

  it('lists the medium with its count, the variant and the grade of a record', () => {
    expect(
      copyBadges('music', 'Vinyl', {
        discCount: 2,
        vinylSize: '12"',
        variant: 'Red',
        mediaCondition: 'NM',
      }),
    ).toEqual(['2×LP', 'Red', 'NM']);
    expect(copyBadges('music', 'Vinyl', { vinylSize: '7"', variant: 'Black' })).toEqual(['7″']);
    expect(copyBadges('music', 'CD', { discCount: 2 })).toEqual(['2×CD']);
  });

  it('lists the platform, storefront or medium and completeness of a game copy', () => {
    const extra = {
      platforms: [
        { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
        { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
      ],
    };
    expect(
      copyBadges(
        'video_game',
        'Digital',
        { platform: 'PC (Microsoft Windows)', storefront: 'Steam' },
        extra,
      ),
    ).toEqual(['PC', 'Steam']);
    expect(
      copyBadges('video_game', 'Disc', { platform: 'PlayStation 5', completeness: 'CIB' }, extra),
    ).toEqual(['PS5', 'Disc', 'CIB']);
    expect(copyBadges('video_game', 'Digital code', { storefront: 'Steam' })).toEqual([
      'Steam code',
    ]);
  });

  it('falls back to a known short platform name without the game data', () => {
    expect(copyBadges('video_game', 'Cartridge', { platform: 'Nintendo Switch' })).toEqual([
      'Switch',
      'Cartridge',
    ]);
  });

  it('shows only the format for other categories', () => {
    expect(copyBadges('board_game', 'Box', {})).toEqual(['Box']);
    expect(copyBadges('board_game', null, {})).toEqual([]);
  });
});
