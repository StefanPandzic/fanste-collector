import type { ItemCategory, MetadataProvider } from './enums';

const TMDB_ID = { movie: /^movie:\d+$/, tv: /^tv:\d+$/ };

/**
 * Whether `externalId` has the format the database enforces (`*_external_id_format`, FC-05):
 * - TMDB: `<category>:<id>`, e.g. `movie:603` / `tv:1396`, because movie and TV IDs overlap;
 * - Discogs: `release:<id>` or `master:<id>`;
 * - IGDB and BGG: the plain numeric ID.
 *
 * Custom items have no external ID, so this is always false for `custom`.
 */
export function isValidExternalId(
  provider: MetadataProvider,
  category: ItemCategory,
  externalId: string,
): boolean {
  switch (provider) {
    case 'tmdb':
      return (category === 'movie' || category === 'tv') && TMDB_ID[category].test(externalId);
    case 'discogs':
      return /^(release|master):\d+$/.test(externalId);
    case 'igdb':
    case 'bgg':
      return /^\d+$/.test(externalId);
    case 'custom':
      return false;
  }
}
