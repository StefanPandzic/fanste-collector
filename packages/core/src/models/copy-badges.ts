import { formatOwnedEpisodes, ownedEpisodeCount, parseDetails } from './copy-details';
import { parseTvExtra, parseVideoGameExtra } from './extras';

import type { ItemCategory } from './enums';

// Short labels of a copy's key details, shown as small badges on gallery cards and rows (FC-18),
// e.g. `4K UHD · Dolby Vision · Steelbook`, `2×LP · Red · NM` or `PS5 · Disc · CIB`.

/** Media whose name is too long for a badge. */
const SHORT_FORMATS: Record<string, string> = {
  '4K UHD Blu-ray': '4K UHD',
  'Digital file': 'File',
  'Digital store': 'Digital',
};

const SHORT_RESOLUTIONS: Record<string, string> = {
  '2160p': '4K',
};

/**
 * Short names of platforms a game's own IGDB data may not list (a copy's platform can be any of the
 * IGDB list). The game's platforms carry their own abbreviation.
 */
const SHORT_PLATFORMS: Record<string, string> = {
  'PC (Microsoft Windows)': 'PC',
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'PlayStation 3': 'PS3',
  'PlayStation 2': 'PS2',
  PlayStation: 'PS1',
  'Xbox Series X|S': 'Series X|S',
  'Xbox One': 'XONE',
  'Xbox 360': 'X360',
  'Nintendo Switch': 'Switch',
  'Nintendo Switch 2': 'Switch 2',
};

/**
 * The badges of a copy, most important first: medium, resolution, HDR, edition, discs, and for TV
 * the owned seasons. `extra` is the item's provider `extra` (TMDB seasons for the TV summary).
 */
export function copyBadges(
  category: ItemCategory,
  format: string | null,
  details: unknown,
  extra?: unknown,
): string[] {
  if (category === 'music') return musicBadges(format, details);
  if (category === 'video_game') return videoGameBadges(format, details, extra);
  if (category !== 'movie' && category !== 'tv') return format ? [format] : [];
  const copy = parseDetails(category, details);
  const badges: string[] = [];

  if (format === 'Digital file' && copy.fileFormat) badges.push(copy.fileFormat);
  else if (format === 'Digital store' && copy.digitalStore) badges.push(copy.digitalStore);
  else if (format) badges.push(SHORT_FORMATS[format] ?? format);

  // A 4K UHD Blu-ray is 2160p by definition.
  if (copy.resolution && !(format === '4K UHD Blu-ray' && copy.resolution === '2160p')) {
    badges.push(SHORT_RESOLUTIONS[copy.resolution] ?? copy.resolution);
  }
  if (copy.hdr && copy.hdr !== 'none') badges.push(copy.hdr);
  if (copy.edition && copy.edition !== 'Standard') badges.push(copy.edition);
  if (copy.discCount !== undefined && copy.discCount > 1) badges.push(`${copy.discCount} discs`);

  if (category === 'tv') {
    const tv = parseDetails('tv', details);
    if (tv.seasons && tv.seasons.length > 0) {
      badges.push(formatOwnedEpisodes(ownedEpisodeCount(tv, parseTvExtra(extra))));
    }
  }
  return badges;
}

/**
 * A music copy: the medium with its count (`2×LP`, `CD`, `7″`), the variant and the media grade.
 * A 12" record is an `LP`, so its size isn't repeated.
 */
function musicBadges(format: string | null, details: unknown): string[] {
  const copy = parseDetails('music', details);
  const badges: string[] = [];
  if (format) {
    let medium = format;
    if (format === 'Vinyl') {
      medium = copy.vinylSize && copy.vinylSize !== '12"' ? copy.vinylSize.replace('"', '″') : 'LP';
    }
    const count = copy.discCount ?? 1;
    badges.push(count > 1 && format !== 'Digital' ? `${count}×${medium}` : medium);
  }
  if (format === 'Vinyl' && copy.variant && copy.variant !== 'Black') badges.push(copy.variant);
  if (copy.mediaCondition) badges.push(copy.mediaCondition);
  return badges;
}

/**
 * A video game copy (FC-11): the platform (short), the storefront of a digital copy or the physical
 * medium, then the discs, a special edition and the completeness, e.g. `PC · Steam` or
 * `PS5 · Disc · CIB`.
 */
function videoGameBadges(format: string | null, details: unknown, extra: unknown): string[] {
  const copy = parseDetails('video_game', details);
  const badges: string[] = [];
  if (copy.platform) {
    const abbreviation = parseVideoGameExtra(extra)?.platforms?.find(
      (platform) => platform.name === copy.platform,
    )?.abbreviation;
    badges.push(abbreviation ?? SHORT_PLATFORMS[copy.platform] ?? copy.platform);
  }
  if (format === 'Digital') badges.push(copy.storefront ?? 'Digital');
  else if (format === 'Digital code') {
    badges.push(copy.storefront ? `${copy.storefront} code` : 'Code');
  } else if (format) badges.push(format);
  if (copy.discCount !== undefined && copy.discCount > 1) badges.push(`${copy.discCount} discs`);
  if (copy.edition && copy.edition !== 'Standard') badges.push(copy.edition);
  if (copy.completeness) badges.push(copy.completeness);
  return badges;
}
