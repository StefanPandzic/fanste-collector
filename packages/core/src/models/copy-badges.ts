import { formatOwnedEpisodes, ownedEpisodeCount, parseDetails } from './copy-details';
import { parseTvExtra } from './extras';

import type { ItemCategory } from './enums';

// Short labels of a copy's key details, shown as small badges on gallery cards and rows (FC-18),
// e.g. `4K UHD · Dolby Vision · Steelbook`. Movies & TV first; game and music badges ("Steam",
// "2×LP") come with FC-11 / FC-10.

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
