import Papa from 'papaparse';

import { categoryOrder, columnsFor, toExportRow } from './columns';

import type { ExportRow } from './columns';
import type { CollectionItem, CustomCollection, Tag } from '@fanste/core';

// CSV export (FC-25), built on the client with PapaParse.

/** Byte order mark: without it, Excel reads a UTF-8 file in the system code page. */
export const UTF8_BOM = '\uFEFF';

/** Orders of the exported rows (SRS §3.3). */
export const EXPORT_SORTS = ['category', 'acquired', 'value'] as const;
export type ExportSort = (typeof EXPORT_SORTS)[number];

export const EXPORT_SORT_LABELS: Record<ExportSort, string> = {
  category: 'Category',
  acquired: 'Acquisition date (newest first)',
  value: 'Estimated value (highest first)',
};

/**
 * Cells PapaParse prefixes with `'`. Its own pattern for `true` ends in `.*$`, which misses a cell
 * with a line break (a multi-line note), so only the first character is checked.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export interface CollectionCsvOptions {
  /** The user's tags, to write their names. */
  tags: readonly Tag[];
  /** The user's custom collections, to write their names (FC-13). */
  collections: readonly CustomCollection[];
  /** Defaults to `category`. */
  sort?: ExportSort;
  /** Adds the provider's title, subtitle and year next to the overridden ones. */
  includeOriginal?: boolean;
}

function titleOf(row: ExportRow): string {
  return row.display?.title ?? row.item.metadataOverrides.title ?? '';
}

function byTitle(a: ExportRow, b: ExportRow): number {
  return titleOf(a).localeCompare(titleOf(b));
}

/** `null` last; larger (or later) first. */
function descending<T extends string | number>(a: T | null, b: T | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

const COMPARE: Record<ExportSort, (a: ExportRow, b: ExportRow) => number> = {
  category: (a, b) =>
    categoryOrder(a.item.category) - categoryOrder(b.item.category) ||
    (a.collectionName ?? '').localeCompare(b.collectionName ?? '') ||
    byTitle(a, b),
  acquired: (a, b) => descending(a.item.acquiredAt, b.item.acquiredAt) || byTitle(a, b),
  value: (a, b) => descending(a.item.estimatedValue, b.item.estimatedValue) || byTitle(a, b),
};

/**
 * The items as a CSV file: a header row, then one row per copy. Titles, subtitles and years show
 * the user's overrides; dates are ISO (`YYYY-MM-DD`); lists are joined with `; `. Starts with a
 * UTF-8 byte order mark and uses CRLF line ends, so Excel, Google Sheets and Numbers all read it.
 * Cells that start like a formula (`=`, `+`, `-`, `@`) are prefixed with `'`, so a spreadsheet
 * never runs them.
 */
export function buildCollectionCsv(
  items: readonly CollectionItem[],
  { tags, collections, sort = 'category', includeOriginal = false }: CollectionCsvOptions,
): string {
  const context = {
    tagNames: new Map(tags.map((tag) => [tag.id, tag.name])),
    collectionNames: new Map(collections.map((collection) => [collection.id, collection.name])),
  };
  const rows = items.map((item) => toExportRow(item, context)).sort(COMPARE[sort]);
  const columns = columnsFor(new Set(items.map((item) => item.category)), { includeOriginal });
  const csv = Papa.unparse(
    {
      fields: columns.map((column) => column.header),
      data: rows.map((row) => columns.map((column) => column.value(row) ?? '')),
    },
    { newline: '\r\n', escapeFormulae: FORMULA_START },
  );
  return UTF8_BOM + csv;
}
