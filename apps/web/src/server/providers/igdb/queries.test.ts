import { describe, expect, it } from 'vitest';

import { IGDB_GAME_FIELDS, igdbGameQuery, igdbSearchQuery } from './queries';

describe('igdbSearchQuery', () => {
  it('searches main games without editions, one page at a time', () => {
    const query = igdbSearchQuery('Elden Ring', { page: 2 });
    expect(query).toContain('search "Elden Ring";');
    expect(query).toContain('where game_type = (0,2,4,8,9,10,11) & version_parent = null;');
    expect(query).toContain('limit 20;');
    expect(query).toContain('offset 20;');
  });

  it('narrows to the release year in Unix seconds', () => {
    const query = igdbSearchQuery('Elden Ring', { page: 1, year: 2022 });
    expect(query).toContain('first_release_date >= 1640995200 & first_release_date < 1672531200;');
    expect(query).toContain('offset 0;');
  });

  it('narrows to games released on the platform', () => {
    expect(igdbSearchQuery('Zelda', { page: 1, platform: 130 })).toContain(
      'where game_type = (0,2,4,8,9,10,11) & version_parent = null & platforms = (130);',
    );
  });

  it('strips quotes from the search text', () => {
    expect(igdbSearchQuery('The "Legend" of Zelda', { page: 1 })).toContain(
      'search "The Legend of Zelda";',
    );
  });
});

describe('igdbGameQuery', () => {
  it('asks for one game by ID', () => {
    expect(igdbGameQuery('119133')).toBe(`${IGDB_GAME_FIELDS} where id = 119133;`);
  });
});
