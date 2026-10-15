import {
  applyOverrides,
  categoryLabel,
  ITEM_CATEGORIES,
  ownershipLabel,
  parseCustomItemData,
  parseDetails,
  providerLabel,
} from '@fanste/core';

import { localIsoDate } from './files';

import type {
  CollectionItem,
  CustomItemData,
  ItemCategory,
  NormalizedItem,
  TvSeasonDetails,
} from '@fanste/core';

/** A collection item with what its columns read, worked out once per export. */
export interface ExportRow {
  item: CollectionItem;
  /** The provider metadata with the user's overrides; `undefined` when it couldn't be loaded. */
  display: NormalizedItem | undefined;
  /** The copy details, typed loosely: each column reads the fields of its own categories. */
  details: Record<string, unknown>;
  /** A hand-entered item's own data (FC-13). */
  customData: CustomItemData | null;
  /** Names of the item's tags. */
  tags: string[];
  /** The custom collection's name (FC-13). */
  collectionName: string | undefined;
}

export type CellValue = string | number | undefined;

export interface CsvColumn {
  header: string;
  /** Categories the column applies to; every category when left out. */
  categories?: readonly ItemCategory[];
  value: (row: ExportRow) => CellValue;
}

/** Lists in one cell (languages, tags, names) are joined with this. */
export const LIST_SEPARATOR = '; ';

const VIDEO: readonly ItemCategory[] = ['movie', 'tv'];

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function list(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter((entry): entry is string => typeof entry === 'string');
  return values.length > 0 ? values.join(LIST_SEPARATOR) : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/** `1-4, 6`: consecutive episodes as ranges. */
function episodeRanges(episodes: readonly number[]): string {
  const ranges: string[] = [];
  let start = episodes[0];
  let end = start;
  for (const episode of [...episodes.slice(1), undefined]) {
    if (episode !== undefined && end !== undefined && episode === end + 1) {
      end = episode;
      continue;
    }
    if (start !== undefined) ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = episode;
    end = episode;
  }
  return ranges.join(', ');
}

/** e.g. `S1: all; S2: 1-4, 6`; season 0 is `Specials`. */
export function formatSeasons(seasons: readonly TvSeasonDetails[] | undefined): string | undefined {
  if (!seasons || seasons.length === 0) return undefined;
  return seasons
    .map((season) => {
      const name = season.seasonNumber === 0 ? 'Specials' : `S${season.seasonNumber}`;
      const episodes = season.episodesOwned === 'all' ? 'all' : episodeRanges(season.episodesOwned);
      return `${name}: ${episodes}`;
    })
    .join(LIST_SEPARATOR);
}

/** The local date of an ISO timestamp, e.g. `2024-05-01`, like the date in the file name. */
function isoDate(timestamp: string): string {
  return localIsoDate(new Date(timestamp));
}

function detail(key: string, categories: readonly ItemCategory[], header: string): CsvColumn {
  return { header, categories, value: (row) => text(row.details[key]) };
}

/** Columns every item has, before the copy details. */
const BASE_COLUMNS: readonly CsvColumn[] = [
  { header: 'Category', value: (row) => categoryLabel(row.item.category) },
  { header: 'Collection', categories: ['custom'], value: (row) => row.collectionName },
  {
    header: 'Title',
    value: (row) => row.display?.title ?? row.item.metadataOverrides.title,
  },
  {
    header: 'Subtitle',
    // A custom item's display subtitle has its number in front; the number has its own column.
    value: (row) =>
      row.item.metadataOverrides.subtitle ??
      (row.customData ? row.customData.subtitle : row.display?.subtitle),
  },
  { header: 'Number / code', categories: ['custom'], value: (row) => row.customData?.identifier },
  {
    header: 'Year',
    value: (row) => row.display?.releaseYear ?? row.item.metadataOverrides.releaseYear,
  },
  { header: 'Creators', value: (row) => list(row.display?.creators) },
  { header: 'Format', value: (row) => row.item.format ?? undefined },
  { header: 'Ownership', value: (row) => ownershipLabel(row.item.ownership) },
  { header: 'Quantity', value: (row) => row.item.quantity },
  { header: 'Acquired date', value: (row) => row.item.acquiredAt ?? undefined },
  { header: 'Purchase price', value: (row) => row.item.purchasePrice ?? undefined },
  { header: 'Estimated value', value: (row) => row.item.estimatedValue ?? undefined },
  { header: 'Currency', value: (row) => row.item.currency ?? undefined },
  { header: 'Tags', value: (row) => list(row.tags) },
  { header: 'Notes', value: (row) => row.item.notes ?? undefined },
];

/** One column per copy-detail field (FC-15), each for the categories that have it. */
const DETAIL_COLUMNS: readonly CsvColumn[] = [
  detail('resolution', VIDEO, 'Resolution'),
  detail('hdr', VIDEO, 'HDR'),
  detail('audioChannels', VIDEO, 'Audio channels'),
  detail('fileFormat', VIDEO, 'File format'),
  {
    header: 'Audio languages',
    categories: VIDEO,
    value: (row) => list(row.details.audioLanguages),
  },
  {
    header: 'Subtitle languages',
    categories: VIDEO,
    value: (row) => list(row.details.subtitleLanguages),
  },
  {
    header: 'Seasons owned',
    categories: ['tv'],
    value: (row) => formatSeasons(row.details.seasons as TvSeasonDetails[] | undefined),
  },
  detail('edition', ['movie', 'tv', 'video_game'], 'Edition'),
  {
    header: 'Disc count',
    categories: ['movie', 'tv', 'music', 'video_game'],
    value: (row) => count(row.details.discCount),
  },
  detail('region', ['movie', 'tv', 'video_game'], 'Region'),
  detail('digitalStore', VIDEO, 'Digital store'),
  detail('vinylSize', ['music'], 'Vinyl size'),
  detail('speed', ['music'], 'Speed'),
  detail('variant', ['music', 'custom'], 'Variant'),
  detail('catalogNumber', ['music'], 'Catalog number'),
  detail('mediaCondition', ['music'], 'Media condition'),
  detail('sleeveCondition', ['music'], 'Sleeve condition'),
  detail('platform', ['video_game'], 'Platform'),
  detail('storefront', ['video_game'], 'Storefront'),
  detail('completeness', ['video_game'], 'Completeness'),
  detail('dlcNotes', ['video_game'], 'DLC'),
  detail('condition', ['custom'], 'Condition'),
  {
    header: 'Boxed',
    categories: ['custom'],
    value: (row) =>
      typeof row.details.boxed === 'boolean' ? (row.details.boxed ? 'Yes' : 'No') : undefined,
  },
];

/** Where the item came from, after the copy details. */
const SOURCE_COLUMNS: readonly CsvColumn[] = [
  { header: 'Provider', value: (row) => providerLabel(row.item.provider) },
  { header: 'External ID', value: (row) => row.item.externalId ?? undefined },
  { header: 'Provider URL', value: (row) => row.item.metadata?.sourceUrl },
  { header: 'Date added', value: (row) => isoDate(row.item.createdAt) },
];

/** The provider's own values, next to the overridden ones ("include original API values"). */
const ORIGINAL_COLUMNS: readonly CsvColumn[] = [
  { header: 'Original title', value: (row) => row.item.metadata?.title },
  { header: 'Original subtitle', value: (row) => row.item.metadata?.subtitle },
  { header: 'Original year', value: (row) => row.item.metadata?.releaseYear },
];

export interface ColumnOptions {
  /** Adds the provider's values of the overridable fields. */
  includeOriginal?: boolean;
}

/**
 * The columns for items of `categories`: the shared columns, plus each column of a field one of the
 * categories has. A file of one category so gets only that category's columns.
 */
export function columnsFor(
  categories: ReadonlySet<ItemCategory>,
  { includeOriginal = false }: ColumnOptions = {},
): CsvColumn[] {
  const applies = (column: CsvColumn) =>
    !column.categories || column.categories.some((category) => categories.has(category));
  return [
    ...BASE_COLUMNS,
    ...DETAIL_COLUMNS,
    ...SOURCE_COLUMNS,
    ...(includeOriginal ? ORIGINAL_COLUMNS : []),
  ].filter(applies);
}

export interface RowContext {
  /** Tag names by ID. */
  tagNames: ReadonlyMap<string, string>;
  /** Custom collection names by ID. */
  collectionNames: ReadonlyMap<string, string>;
}

export function toExportRow(item: CollectionItem, context: RowContext): ExportRow {
  return {
    item,
    display: item.metadata ? applyOverrides(item.metadata, item.metadataOverrides).item : undefined,
    details: parseDetails(item.category, item.details),
    customData: item.provider === 'custom' ? parseCustomItemData(item.customData) : null,
    tags: item.tagIds.flatMap((id) => {
      const name = context.tagNames.get(id);
      return name === undefined ? [] : [name];
    }),
    collectionName: item.customCollectionId
      ? context.collectionNames.get(item.customCollectionId)
      : undefined,
  };
}

/** Position of a category in the app's order (movies first). */
export function categoryOrder(category: ItemCategory): number {
  return ITEM_CATEGORIES.indexOf(category);
}
