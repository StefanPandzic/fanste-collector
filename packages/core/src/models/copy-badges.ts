import { formatOwnedEpisodes, ownedEpisodeCount, parseDetails } from './copy-details';
import { parseTvExtra } from './extras';

import type { ItemCategory } from './enums';

// Short labels of a copy's key details, shown as small badges on gallery cards and rows (FC-18),
// e.g. `4K UHD · Dolby Vision · Steelbook` or `2×LP · Red · NM`. Game badges ("Steam") come with
// FC-11.

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
