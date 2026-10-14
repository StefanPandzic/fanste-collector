import {
  MAX_GAME_PLATFORMS,
  MAX_RELEASE_YEAR,
  MAX_SEARCH_DETAIL_LENGTH,
  MIN_RELEASE_YEAR,
} from '@fanste/core';

import { GAME_TYPE_NAMES } from './queries';

import type { IgdbGame, IgdbInvolvedCompany, IgdbPlatform } from './schemas';
import type { GamePlatform, NormalizedItem, SearchResult, VideoGameExtra } from '@fanste/core';

// IGDB payloads → `NormalizedItem` / `SearchResult` (FC-11). Missing and blank values become missing
// fields, so the results pass the strict core schemas.

const IMAGE_URL = 'https://images.igdb.com/igdb/image/upload';
/** IGDB's site, the only `url` kept as the source link. */
const SITE_URL = /^https:\/\/www\.igdb\.com\//;
/** Longest description kept from a game's summary. */
const MAX_DESCRIPTION_LENGTH = 5000;
/** Platforms named in a search result's `detail`; the rest are counted (`+2`). */
const DETAIL_PLATFORMS = 5;

/**
 * Cover sizes: `t_cover_big` (264×374) for cards and lists, its 2× version for the item page. The
 * square `t_thumb` (90×90) would be cropped and blurry on a portrait card.
 */
const COVER_SIZE = 't_cover_big_2x';
const THUMBNAIL_SIZE = 't_cover_big';

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function unique(values: readonly (string | null | undefined)[]): string[] | undefined {
  const list = [...new Set(values.flatMap((value) => text(value) ?? []))];
  return list.length > 0 ? list : undefined;
}

/** The UTC year of a Unix timestamp in seconds. */
export function releaseYear(seconds: number | null | undefined): number | undefined {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return undefined;
  const year = new Date(seconds * 1000).getUTCFullYear();
  return year >= MIN_RELEASE_YEAR && year <= MAX_RELEASE_YEAR ? year : undefined;
}

/** `https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg`. */
export function coverUrl(imageId: string | null | undefined, size: string): string | undefined {
  const id = text(imageId);
  return id && /^\w+$/.test(id) ? `${IMAGE_URL}/${size}/${id}.jpg` : undefined;
}

/** A platform as the core model has it; `undefined` without a name. */
export function mapPlatform(platform: IgdbPlatform): GamePlatform | undefined {
  const name = text(platform.name);
  if (!name) return undefined;
  const abbreviation = text(platform.abbreviation);
  return { id: platform.id, name, ...(abbreviation ? { abbreviation } : {}) };
}

function platformsOf(game: IgdbGame): GamePlatform[] {
  return (game.platforms ?? [])
    .flatMap((platform) => mapPlatform(platform) ?? [])
    .slice(0, MAX_GAME_PLATFORMS);
}

function companies(
  involved: readonly IgdbInvolvedCompany[] | null | undefined,
  role: 'developer' | 'publisher',
): string[] | undefined {
  return unique(
    (involved ?? []).filter((entry) => entry[role]).map((entry) => entry.company?.name),
  );
}

/** The platforms of a search result, e.g. `PC · PS5 · XONE · +2` (each part is a card badge). */
export function platformDetail(platforms: readonly GamePlatform[]): string | undefined {
  const names = platforms.map((platform) => platform.abbreviation ?? platform.name);
  if (names.length === 0) return undefined;
  const shown = names.slice(0, DETAIL_PLATFORMS).join(' · ');
  const rest = names.length - DETAIL_PLATFORMS;
  const detail = rest > 0 ? `${shown} · +${rest}` : shown;
  return detail.slice(0, MAX_SEARCH_DETAIL_LENGTH);
}

function description(summary: string | null | undefined): string | undefined {
  const value = text(summary?.replace(/\r\n/g, '\n'));
  return value && value.length > MAX_DESCRIPTION_LENGTH
    ? `${value.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`
    : value;
}

/** Fields shared by search results and items; `undefined` for a game without a name. */
function baseFields(game: IgdbGame) {
  const title = text(game.name);
  if (!title) return undefined;
  const developers = companies(game.involved_companies, 'developer');
  return {
    provider: 'igdb' as const,
    externalId: String(game.id),
    category: 'video_game' as const,
    title,
    ...(developers ? { subtitle: developers.join(', ') } : {}),
    ...(releaseYear(game.first_release_date)
      ? { releaseYear: releaseYear(game.first_release_date) }
      : {}),
  };
}

/**
 * Results whose title is the search text come first, in IGDB's order otherwise: IGDB's own ranking
 * puts "Elden Ring Nightreign" above "Elden Ring".
 */
export function exactTitlesFirst(results: readonly SearchResult[], q: string): SearchResult[] {
  const wanted = q.trim().toLowerCase();
  const exact = (result: SearchResult) => result.title.toLowerCase() === wanted;
  return [...results.filter(exact), ...results.filter((result) => !exact(result))];
}

/** A search result: the developers as subtitle, the platforms as `detail`. */
export function mapSearchResult(game: IgdbGame): SearchResult | undefined {
  const base = baseFields(game);
  if (!base) return undefined;
  const thumbnailUrl = coverUrl(game.cover?.image_id, THUMBNAIL_SIZE);
  const detail = platformDetail(platformsOf(game));
  return {
    ...base,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(detail ? { detail } : {}),
  };
}

/**
 * A full game: the developers are its `creators` (and subtitle), the platforms, publishers and game
 * type go in `extra` (`VideoGameExtra`).
 */
export function mapGame(game: IgdbGame): NormalizedItem | undefined {
  const base = baseFields(game);
  if (!base) return undefined;
  const developers = companies(game.involved_companies, 'developer');
  const publishers = companies(game.involved_companies, 'publisher');
  const platforms = platformsOf(game);
  const gameType =
    game.game_type === null || game.game_type === undefined
      ? undefined
      : GAME_TYPE_NAMES[game.game_type];
  const extra: VideoGameExtra = {
    ...(platforms.length > 0 ? { platforms } : {}),
    ...(publishers ? { publishers } : {}),
    ...(gameType ? { gameType } : {}),
  };
  const imageUrl = coverUrl(game.cover?.image_id, COVER_SIZE);
  const thumbnailUrl = coverUrl(game.cover?.image_id, THUMBNAIL_SIZE);
  const summary = description(game.summary);
  const genres = unique((game.genres ?? []).map((genre) => genre.name));
  const sourceUrl = text(game.url);
  return {
    ...base,
    ...(imageUrl ? { imageUrl } : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(summary ? { description: summary } : {}),
    ...(genres ? { genres } : {}),
    ...(developers ? { creators: developers } : {}),
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
    ...(sourceUrl && SITE_URL.test(sourceUrl) ? { sourceUrl } : {}),
  };
}
