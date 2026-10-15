import { VALUED_STATUSES } from '@fanste/core';
import { groupKeyOf, targetFilters } from '@fanste/export';

import type { ExportProgress, ExportScope } from '@fanste/collection';
import type { CollectionFilter, CollectionItem } from '@fanste/core';
import type { ExportGroupKey, ExportTarget, PdfLayout } from '@fanste/export';

/** The file an export makes: a CSV spreadsheet (FC-25) or a PDF catalog (FC-26). */
export const EXPORT_FORMATS = ['csv', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** What an export starts from (FC-25). */
export type ExportSource =
  | { kind: 'all' }
  /** The gallery's filters. */
  | { kind: 'filter'; filter: CollectionFilter }
  /** The gallery's selected items. */
  | { kind: 'selection'; items: readonly CollectionItem[] };

export function baseFilterOf(source: ExportSource): CollectionFilter {
  return source.kind === 'filter' ? source.filter : {};
}

/**
 * What to load for the picked groups. Picking every group loads the scope in one query; otherwise
 * one per picked category (and one for the picked custom collections).
 */
export function exportLoadScope(
  source: ExportSource,
  targets: readonly ExportTarget[],
  picked: ReadonlySet<ExportGroupKey>,
): ExportScope {
  if (source.kind === 'selection') {
    return {
      ids: source.items.filter((item) => picked.has(groupKeyOf(item))).map((item) => item.id),
    };
  }
  const base = baseFilterOf(source);
  if (targets.every((target) => picked.has(target.key))) return { filters: [base] };
  return {
    filters: targetFilters(
      base,
      targets.filter((target) => picked.has(target.key)).map((target) => target.key),
    ),
  };
}

function items(count: number): string {
  return `${count.toLocaleString()} item${count === 1 ? '' : 's'}`;
}

/** e.g. `Your whole collection`, `The 12 items matching your filters`. */
export function sourceDescription(source: ExportSource, total: number | undefined): string {
  if (source.kind === 'all') return 'Your whole collection.';
  if (source.kind === 'selection') return `The ${items(source.items.length)} you selected.`;
  return total === undefined
    ? 'The items matching your filters.'
    : `The ${items(total)} matching your filters.`;
}

/**
 * The items a PDF layout prints from `source`: the insurance list keeps only the copies the user
 * has (`VALUED_STATUSES`, the dashboard's rule), within the source's own status filter.
 * `null` when the source's status filter leaves none.
 */
export function pdfSource(source: ExportSource, layout: PdfLayout): ExportSource | null {
  if (layout === 'grid') return source;
  const valued = (status: string) => (VALUED_STATUSES as readonly string[]).includes(status);
  if (source.kind === 'selection') {
    return { kind: 'selection', items: source.items.filter((item) => valued(item.ownership)) };
  }
  const base = baseFilterOf(source);
  const ownership = base.ownership?.length ? base.ownership.filter(valued) : [...VALUED_STATUSES];
  return ownership.length > 0 ? { kind: 'filter', filter: { ...base, ownership } } : null;
}

/** Progress of an export: loading the items (FC-25), then a PDF's covers and pages (FC-26). */
export type ExportDialogProgress =
  ExportProgress | { phase: 'fonts' | 'covers' | 'pdf'; loaded: number; total: number };

/**
 * e.g. `Loading 400 of 5,000 items…`, then `Loading details of 20 of 80 items…`; for a PDF
 * `Loading covers: 120 of 500…` and `Building the PDF: 300 of 500 items…`.
 */
export function progressLabel(progress: ExportDialogProgress): string {
  const count = `${progress.loaded.toLocaleString()} of ${progress.total.toLocaleString()}`;
  switch (progress.phase) {
    case 'fonts':
      return 'Loading fonts…';
    case 'covers':
      return `Loading covers: ${count}…`;
    case 'pdf':
      return `Building the PDF: ${count} items…`;
    default: {
      const what = progress.phase === 'metadata' ? 'Loading details of' : 'Loading';
      return progress.total > 0
        ? `${what} ${progress.loaded.toLocaleString()} of ${items(progress.total)}…`
        : 'Loading items…';
    }
  }
}
