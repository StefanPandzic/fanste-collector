import {
  MAX_MATRIX_CODES,
  MAX_RELEASE_YEAR,
  MAX_SEARCH_DETAIL_LENGTH,
  MAX_TRACKLIST_LENGTH,
  MIN_RELEASE_YEAR,
} from '@fanste/core';

import type {
  DiscogsArtist,
  DiscogsFormat,
  DiscogsIdentifier,
  DiscogsImage,
  DiscogsLabel,
  DiscogsMaster,
  DiscogsRelease,
  DiscogsSearchResult,
  DiscogsTrack,
} from './schemas';
import type {
  MusicExtra,
  MusicFormatInfo,
  MusicLabel,
  MusicMatrix,
  MusicTrack,
  NormalizedItem,
  SearchResult,
} from '@fanste/core';

// Discogs payloads → `NormalizedItem` / `SearchResult` (FC-10). Unknown values (`""`, `0`, `none`)
// become missing fields, so the results pass the strict core schemas.

export type DiscogsKind = 'release' | 'master';

const SITE_URL = 'https://www.discogs.com';
/** Discogs' image host, the one `images.remotePatterns` allows; other URLs are placeholders. */
const IMAGE_URL = /^https:\/\/i\.discogs\.com\//;
/** Longest description kept from a release's notes. */
const MAX_DESCRIPTION_LENGTH = 5000;
/** Descriptions of a format shown in a search result's `detail`, e.g. `LP, Album, Reissue`. */
const DETAIL_DESCRIPTIONS = 3;

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** A positive whole number from a number or a numeric string. */
function positive(value: number | string | null | undefined): number | undefined {
  const number = typeof value === 'string' ? Number(value.trim() || Number.NaN) : value;
  return number !== null && number !== undefined && Number.isInteger(number) && number > 0
    ? number
    : undefined;
}

function year(value: number | string | null | undefined): number | undefined {
  const number = positive(value);
  return number !== undefined && number >= MIN_RELEASE_YEAR && number <= MAX_RELEASE_YEAR
    ? number
    : undefined;
}

function unique(values: readonly (string | undefined)[]): string[] | undefined {
  const list = [...new Set(values.flatMap((value) => text(value) ?? []))];
  return list.length > 0 ? list : undefined;
}

/** Drops `undefined` fields; `undefined` when nothing is left. */
function compact<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, field]) => field !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/** Drops the number Discogs adds to tell artists of the same name apart: `Prince (2)` → `Prince`. */
export function artistName(name: string | null | undefined): string | undefined {
  return text(name?.replace(/\s+\(\d+\)$/, ''));
}

/** The credit line, e.g. `Simon & Garfunkel` or `Daft Punk Feat. Pharrell Williams`. */
export function artistCredit(artists: readonly DiscogsArtist[] | null | undefined) {
  const named = (artists ?? []).flatMap((artist) => {
    const name = artistName(artist.name);
    return name ? [{ name, join: text(artist.join) }] : [];
  });
  return text(
    named
      .map(({ name, join }, index) => {
        if (index === named.length - 1) return name;
        if (!join || join === ',') return `${name}, `;
        return `${name} ${join} `;
      })
      .join(''),
  );
}

/** A catalog number, unless it's Discogs' "none". */
function catalogNumber(value: string | null | undefined): string | undefined {
  const catno = text(value);
  return catno && catno.toLowerCase() !== 'none' ? catno : undefined;
}

function imageUrl(value: string | null | undefined): string | undefined {
  const url = text(value);
  return url && IMAGE_URL.test(url) ? url : undefined;
}

/** The primary image (or the first one), as a full-size and a thumbnail URL. */
function cover(images: readonly DiscogsImage[] | null | undefined, thumb?: string | null) {
  const image = images?.find((entry) => entry.type === 'primary') ?? images?.[0];
  const full = imageUrl(image?.uri);
  return { imageUrl: full, thumbnailUrl: imageUrl(image?.uri150) ?? imageUrl(thumb) ?? full };
}

/**
 * Removes Discogs markup from notes: `[a=Artist]` → `Artist`, `[url=…]text[/url]` → `text`. An
 * artist ID reference (`[a82730]`) becomes the name of that artist when it's one of `artists` (the
 * item's credits); other ID references (`[r123]`, `[l45]`, unknown artists) are removed.
 */
export function plainNotes(
  notes: string | null | undefined,
  artists: readonly DiscogsArtist[] = [],
): string | undefined {
  const names = new Map(
    artists.flatMap((artist) => {
      const name = artistName(artist.name);
      return artist.id !== null && artist.id !== undefined && name ? [[artist.id, name]] : [];
    }),
  );
  const plain = notes
    ?.replace(/\[url=[^\]]*\]([^[]*)\[\/url\]/gi, '$1')
    .replace(/\[[almr]=([^\]]+)\]/gi, '$1')
    .replace(/\[a(\d+)\]/gi, (_match, id: string) => names.get(Number(id)) ?? '')
    .replace(/\[[lmr]\d+\]/gi, '')
    .replace(/\[\/?[biu]\]/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\r\n/g, '\n');
  const value = text(plain);
  return value && value.length > MAX_DESCRIPTION_LENGTH
    ? `${value.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`
    : value;
}

function mapFormat(format: DiscogsFormat): MusicFormatInfo | undefined {
  const name = text(format.name);
  if (!name) return undefined;
  return compact<MusicFormatInfo>({
    name,
    quantity: positive(format.qty),
    descriptions: unique(format.descriptions ?? []),
    text: text(format.text),
  });
}

function mapFormats(formats: readonly DiscogsFormat[] | null | undefined) {
  const list = (formats ?? []).flatMap((format) => mapFormat(format) ?? []);
  return list.length > 0 ? list : undefined;
}

/** Labels without duplicates (a label often appears once per role). */
function mapLabels(labels: readonly DiscogsLabel[] | null | undefined): MusicLabel[] | undefined {
  const seen = new Set<string>();
  const list = (labels ?? []).flatMap((label): MusicLabel[] => {
    const name = artistName(label.name);
    if (!name) return [];
    const catno = catalogNumber(label.catno);
    const key = `${name}\u0000${catno ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name, ...(catno ? { catalogNumber: catno } : {}) }];
  });
  return list.length > 0 ? list : undefined;
}

/** The tracks, with an index track's sub-tracks in its place; headings are left out. */
function mapTracklist(
  tracks: readonly DiscogsTrack[] | null | undefined,
): MusicTrack[] | undefined {
  const list = (tracks ?? [])
    .flatMap((track) => (track.type_ === 'index' ? (track.sub_tracks ?? []) : [track]))
    .flatMap((track): MusicTrack[] => {
      const title = text(track.title);
      if (!title || (track.type_ && track.type_ !== 'track')) return [];
      const position = text(track.position);
      const duration = text(track.duration);
      return [{ ...(position ? { position } : {}), title, ...(duration ? { duration } : {}) }];
    })
    .slice(0, MAX_TRACKLIST_LENGTH);
  return list.length > 0 ? list : undefined;
}

/** The release's barcodes, without duplicates. */
export function barcodesOf(
  identifiers: readonly DiscogsIdentifier[] | null | undefined,
): string[] | undefined {
  return unique(
    (identifiers ?? [])
      .filter((identifier) => identifier.type === 'Barcode')
      .map((identifier) => text(identifier.value)),
  )?.slice(0, MAX_MATRIX_CODES);
}

/** The release's matrix / runout codes, with the side or variant they're on. */
export function matrixOf(
  identifiers: readonly DiscogsIdentifier[] | null | undefined,
): MusicMatrix[] | undefined {
  const list = (identifiers ?? [])
    .filter((identifier) => identifier.type === 'Matrix / Runout')
    .flatMap((identifier): MusicMatrix[] => {
      const value = text(identifier.value);
      const description = text(identifier.description);
      return value ? [{ value, ...(description ? { description } : {}) }] : [];
    })
    .slice(0, MAX_MATRIX_CODES);
  return list.length > 0 ? list : undefined;
}

export function discogsExternalId(kind: DiscogsKind, id: number): string {
  return `${kind}:${id}`;
}

export function discogsSourceUrl(kind: DiscogsKind, id: number): string {
  return `${SITE_URL}/${kind}/${id}`;
}

/**
 * What tells a pressing apart in a result list: its formats, country and catalog number, e.g.
 * `2×Vinyl, LP, Album · UK · PCS 7088`.
 */
export function searchDetail(result: DiscogsSearchResult): string | undefined {
  const formats = (result.formats ?? []).flatMap((format) => {
    const name = text(format.name);
    if (!name) return [];
    const quantity = positive(format.qty) ?? 1;
    const descriptions = unique(format.descriptions ?? [])?.slice(0, DETAIL_DESCRIPTIONS) ?? [];
    return [[`${quantity > 1 ? `${quantity}×` : ''}${name}`, ...descriptions].join(', ')];
  });
  const formatText =
    formats.length > 0
      ? formats.join(' + ')
      : unique(result.format ?? [])
          ?.slice(0, DETAIL_DESCRIPTIONS + 1)
          .join(', ');
  const detail = [formatText, text(result.country), catalogNumber(result.catno)]
    .filter(Boolean)
    .join(' · ');
  return detail ? detail.slice(0, MAX_SEARCH_DETAIL_LENGTH) : undefined;
}

/** A search result for a list, or `undefined` when Discogs sent it without a title. */
export function mapSearchResult(result: DiscogsSearchResult): SearchResult | undefined {
  const full = text(result.title);
  if (!full) return undefined;
  // `"Artist - Title"`; artist names have no " - ", titles sometimes do.
  const split = full.indexOf(' - ');
  const title = split === -1 ? full : text(full.slice(split + 3));
  const artists =
    split === -1 ? undefined : text(full.slice(0, split).replace(/\s+\(\d+\)(?=$|[\s,&/])/g, ''));
  return {
    provider: 'discogs',
    externalId: discogsExternalId('release', result.id),
    category: 'music',
    title: title ?? full,
    subtitle: artists,
    releaseYear: year(result.year),
    thumbnailUrl: imageUrl(result.thumb) ?? imageUrl(result.cover_image),
    detail: searchDetail(result),
  };
}

function baseItem(kind: DiscogsKind, item: DiscogsRelease | DiscogsMaster, thumb?: string | null) {
  const title = text(item.title);
  if (!title) return undefined;
  const credit = artistCredit(item.artists);
  return {
    provider: 'discogs',
    externalId: discogsExternalId(kind, item.id),
    category: 'music',
    title,
    subtitle: credit,
    releaseYear: year(item.year),
    ...cover(item.images, thumb),
    description: plainNotes(item.notes, item.artists ?? []),
    genres: unique([...(item.genres ?? []), ...(item.styles ?? [])]),
    creators: unique((item.artists ?? []).map((artist) => artistName(artist.name))),
    sourceUrl: discogsSourceUrl(kind, item.id),
  } satisfies Omit<NormalizedItem, 'extra'>;
}

/** `/releases/{id}`: one pressing, with its labels, formats and tracklist in `extra`. */
export function mapRelease(release: DiscogsRelease): NormalizedItem | undefined {
  const item = baseItem('release', release, release.thumb);
  if (!item) return undefined;
  const labels = mapLabels(release.labels);
  const extra = compact<MusicExtra>({
    discogsType: 'release',
    country: text(release.country),
    labels,
    catalogNumber: labels?.find((label) => label.catalogNumber)?.catalogNumber,
    formats: mapFormats(release.formats),
    tracklist: mapTracklist(release.tracklist),
    barcodes: barcodesOf(release.identifiers),
    matrix: matrixOf(release.identifiers),
    masterId: positive(release.master_id),
  });
  return { ...item, extra };
}

/** `/masters/{id}`: the album across its pressings. A master has no labels or formats. */
export function mapMaster(master: DiscogsMaster): NormalizedItem | undefined {
  const item = baseItem('master', master);
  if (!item) return undefined;
  const extra = compact<MusicExtra>({
    discogsType: 'master',
    tracklist: mapTracklist(master.tracklist),
  });
  return { ...item, extra };
}
