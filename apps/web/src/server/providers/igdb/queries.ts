// The Apicalypse queries the IGDB adapter sends (FC-11). `scripts/record-igdb-fixtures.mjs` copies
// them, so keep the two in step.

/** Results per search page, like TMDB's 20. */
export const IGDB_PAGE_SIZE = 20;

/**
 * Game types a search returns (IGDB `game_types`): main games, expansions, standalone expansions,
 * remakes, remasters, expanded games and ports. DLC, bundles, packs, mods, episodes, seasons,
 * updates and forks are left out.
 */
export const SEARCHED_GAME_TYPES = [0, 2, 4, 8, 9, 10, 11] as const;

/** IGDB `game_types` by ID, for `VideoGameExtra.gameType`. */
export const GAME_TYPE_NAMES: Readonly<Record<number, string>> = {
  0: 'Main Game',
  1: 'DLC',
  2: 'Expansion',
  3: 'Bundle',
  4: 'Standalone Expansion',
  5: 'Mod',
  6: 'Episode',
  7: 'Season',
  8: 'Remake',
  9: 'Remaster',
  10: 'Expanded Game',
  11: 'Port',
  12: 'Fork',
  13: 'Pack / Addon',
  14: 'Update',
};

const SEARCH_FIELDS =
  'fields name, first_release_date, cover.image_id, platforms.name, platforms.abbreviation, ' +
  'involved_companies.developer, involved_companies.company.name;';

/** The fields `getById` reads. */
export const IGDB_GAME_FIELDS =
  'fields name, summary, first_release_date, cover.image_id, genres.name, url, game_type, ' +
  'platforms.name, platforms.abbreviation, involved_companies.developer, ' +
  'involved_companies.publisher, involved_companies.company.name;';

/** Every platform (IGDB has about 220; one request returns up to 500). */
export const IGDB_PLATFORM_QUERY = 'fields name, abbreviation; sort name asc; limit 500;';

/** The search text as an Apicalypse string: quotes and backslashes would end it, so they go. */
export function searchText(q: string): string {
  return q.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Unix seconds of 1 January of `year`, UTC. */
function yearStart(year: number): number {
  return Date.UTC(year, 0, 1) / 1000;
}

/**
 * One page of games matching `q`, without editions IGDB lists as games of their own
 * (`version_parent`; the edition is a copy detail). `year` narrows to the first release year,
 * `platform` (an IGDB platform ID) to games released on it.
 */
export function igdbSearchQuery(
  q: string,
  { page, year, platform }: { page: number; year?: number; platform?: number },
) {
  const where = [
    `game_type = (${SEARCHED_GAME_TYPES.join(',')})`,
    'version_parent = null',
    ...(platform === undefined ? [] : [`platforms = (${platform})`]),
    ...(year === undefined
      ? []
      : [
          `first_release_date >= ${yearStart(year)}`,
          `first_release_date < ${yearStart(year + 1)}`,
        ]),
  ];
  return [
    `search "${searchText(q)}";`,
    SEARCH_FIELDS,
    `where ${where.join(' & ')};`,
    `limit ${IGDB_PAGE_SIZE};`,
    `offset ${(page - 1) * IGDB_PAGE_SIZE};`,
  ].join(' ');
}

/** The game with the ID (digits only, checked by the adapter). */
export function igdbGameQuery(id: string): string {
  return `${IGDB_GAME_FIELDS} where id = ${id};`;
}
