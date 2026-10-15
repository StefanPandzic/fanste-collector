import {
  buildCollectionPdf,
  buildPdfModel,
  coverUrls,
  fontNeeds,
  printedTexts,
} from '@fanste/export';

import { loadCovers, loadPdfFonts } from './pdf-assets';

import type { ExportDialogProgress } from './export-view';
import type { CollectionItem, CustomCollection } from '@fanste/core';
import type { ExportFile, PaperSize, PdfLayout } from '@fanste/export';

export interface PdfExportOptions {
  layout: PdfLayout;
  paper: PaperSize;
  includePrices: boolean;
  collections: readonly CustomCollection[];
  userName: string;
  signal?: AbortSignal;
  onProgress?: (progress: ExportDialogProgress) => void;
}

export interface PdfExportResult {
  file: ExportFile;
  /** Covers that couldn't be loaded and are drawn as placeholders. */
  missingCovers: number;
}

/**
 * The PDF catalog of loaded items (FC-26): the fonts its text needs and the covers load at the same
 * time, then `@fanste/export` draws the pages in the browser.
 */
export async function buildPdfExport(
  items: readonly CollectionItem[],
  { layout, paper, includePrices, collections, userName, signal, onProgress }: PdfExportOptions,
): Promise<PdfExportResult> {
  const model = buildPdfModel(items, { layout, collections });
  const date = new Date();
  const urls = coverUrls(model);
  onProgress?.(
    urls.length > 0
      ? { phase: 'covers', loaded: 0, total: urls.length }
      : { phase: 'fonts', loaded: 0, total: 0 },
  );
  const [fonts, covers] = await Promise.all([
    // Dates and amounts count too: in some locales they are written in CJK characters.
    loadPdfFonts(fontNeeds(printedTexts(model, { userName, date })), signal),
    loadCovers(urls, {
      signal,
      onProgress: (done) => onProgress?.({ phase: 'covers', loaded: done, total: urls.length }),
    }),
  ]);
  const file = await buildCollectionPdf(model, {
    paper,
    includePrices,
    userName,
    date,
    covers,
    fonts,
    signal,
    onProgress: (done, total) => onProgress?.({ phase: 'pdf', loaded: done, total }),
  });
  const missingCovers = [...covers.values()].filter((cover) => cover === null).length;
  return { file, missingCovers };
}
