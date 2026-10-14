import { describe, expect, it } from 'vitest';

import { parseVideoGameExtra } from '@fanste/core';

import gameFixture from './__fixtures__/game-119133.json';
import searchFixture from './__fixtures__/search-elden-ring.json';
import {
  coverUrl,
  exactTitlesFirst,
  mapGame,
  mapPlatform,
  mapSearchResult,
  platformDetail,
  releaseYear,
} from './mappers';
import { igdbGamesSchema } from './schemas';

import type { SearchResult } from '@fanste/core';

const [eldenRing] = igdbGamesSchema.parse(gameFixture);
const searchGames = igdbGamesSchema.parse(searchFixture.body);
const eldenRingResult = searchGames.find((game) => game.id === 119133);

describe('releaseYear', () => {
  it('reads the UTC year of a Unix timestamp in seconds', () => {
    expect(releaseYear(1645747200)).toBe(2022);
  });
});

describe('coverUrl', () => {
  it('builds an IGDB image URL in the given size', () => {
    expect(coverUrl('co4jni', 't_cover_big')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
    );
  });
});

describe('mapPlatform', () => {
  it('keeps the name and abbreviation of a platform', () => {
    expect(mapPlatform({ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' })).toEqual({
      id: 167,
      name: 'PlayStation 5',
      abbreviation: 'PS5',
    });
    expect(mapPlatform({ id: 139, name: '1292 Advanced Programmable Video System' })).toEqual({
      id: 139,
      name: '1292 Advanced Programmable Video System',
    });
  });

  it('drops a platform without a name', () => {
    expect(mapPlatform({ id: 999, name: ' ' })).toBeUndefined();
  });
});

describe('platformDetail', () => {
  it('lists five platform abbreviations and counts the rest', () => {
    expect(
      platformDetail([
        { id: 169, name: 'Xbox Series X|S', abbreviation: 'Series X|S' },
        { id: 48, name: 'PlayStation 4', abbreviation: 'PS4' },
        { id: 508, name: 'Nintendo Switch 2', abbreviation: 'Switch 2' },
        { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
        { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
        { id: 49, name: 'Xbox One', abbreviation: 'XONE' },
      ]),
    ).toBe('Series X|S · PS4 · Switch 2 · PC · PS5 · +1');
    expect(platformDetail([{ id: 507, name: 'Advanced Pico Beena' }])).toBe('Advanced Pico Beena');
  });
});

describe('mapSearchResult', () => {
  it('maps a game with its developer, cover and platforms', () => {
    expect(eldenRingResult && mapSearchResult(eldenRingResult)).toEqual({
      provider: 'igdb',
      externalId: '119133',
      category: 'video_game',
      title: 'Elden Ring',
      subtitle: 'FromSoftware',
      releaseYear: 2022,
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg',
      detail: 'Series X|S · PS4 · Switch 2 · PC · PS5 · +1',
    });
  });
});

describe('mapGame', () => {
  it('maps a full game with its platforms, publishers and game type', () => {
    const item = eldenRing && mapGame(eldenRing);
    expect(item).toMatchObject({
      provider: 'igdb',
      externalId: '119133',
      category: 'video_game',
      title: 'Elden Ring',
      subtitle: 'FromSoftware',
      releaseYear: 2022,
      imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co4jni.jpg',
      creators: ['FromSoftware'],
      genres: ['Role-playing (RPG)', 'Adventure'],
      sourceUrl: 'https://www.igdb.com/games/elden-ring',
    });

    const extra = parseVideoGameExtra(item?.extra);
    expect(extra?.publishers).toEqual(['Bandai Namco Entertainment', 'FromSoftware']);
    expect(extra?.gameType).toBe('Main Game');
    expect(extra?.platforms?.map((platform) => platform.abbreviation)).toEqual([
      'Series X|S',
      'PS4',
      'Switch 2',
      'PC',
      'PS5',
      'XONE',
    ]);
  });
});

describe('exactTitlesFirst', () => {
  it('moves results titled like the search text to the front', () => {
    const results = searchGames.flatMap((game) => mapSearchResult(game) ?? []);
    const titles = exactTitlesFirst(results, 'elden ring ').map(
      (result: SearchResult) => result.title,
    );
    expect(titles.slice(0, 3)).toEqual(['Elden Ring', 'Elden Ring Nightreign', 'Elden Ring GB']);
  });
});
