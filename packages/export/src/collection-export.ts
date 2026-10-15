import { buildCollectionCsv } from './csv';
import {
  buildZip,
  EXPORT_FILE_PREFIX,
  exportFileName,
  localIsoDate,
  uniqueFileNames,
} from './files';
import { groupForExport } from './groups';

import type { CollectionCsvOptions } from './csv';
import type { CollectionItem } from '@fanste/core';

/** One CSV of everything, or one CSV per category / custom collection in a ZIP. */
export const EXPORT_LAYOUTS = ['single', 'per-group'] as const;
export type ExportLayout = (typeof EXPORT_LAYOUTS)[number];

export interface CollectionExportOptions extends CollectionCsvOptions {
  layout: ExportLayout;
  /** The export's date, for the file names. */
  date: Date;
}

/** A file ready to save. */
export interface ExportFile {
  name: string;
  /** The file name extension. */
  type: 'csv' | 'zip';
  mimeType: 'text/csv' | 'application/zip';
  data: string | Uint8Array;
}

/**
 * The export file of `items`: `fanste-collection-YYYY-MM-DD.csv`, or a `.zip` holding one CSV per
 * group (`fanste-collection-YYYY-MM-DD-movies.csv`, ...), each with only its group's columns.
 */
export function buildCollectionExport(
  items: readonly CollectionItem[],
  { layout, date, ...csvOptions }: CollectionExportOptions,
): ExportFile {
  if (layout === 'single') {
    return {
      name: exportFileName(date, 'csv'),
      type: 'csv',
      mimeType: 'text/csv',
      data: buildCollectionCsv(items, csvOptions),
    };
  }
  const groups = groupForExport(items, csvOptions.collections);
  const prefix = `${EXPORT_FILE_PREFIX}-${localIsoDate(date)}`;
  const names = uniqueFileNames(
    groups.map((group) => group.label),
    'csv',
  );
  return {
    name: exportFileName(date, 'zip'),
    type: 'zip',
    mimeType: 'application/zip',
    data: buildZip(
      groups.map((group, index) => ({
        name: `${prefix}-${names[index] ?? 'item.csv'}`,
        content: buildCollectionCsv(group.items, csvOptions),
      })),
    ),
  };
}
