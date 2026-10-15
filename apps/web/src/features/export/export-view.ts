import { groupKeyOf, targetFilters } from '@fanste/export';

import type { ExportProgress, ExportScope } from '@fanste/collection';
import type { CollectionFilter, CollectionItem } from '@fanste/core';
import type { ExportGroupKey, ExportTarget } from '@fanste/export';

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

/** e.g. `Loading 400 of 5,000 items…`, then `Loading details of 20 of 80 items…`. */
export function progressLabel(progress: ExportProgress): string {
  const what = progress.phase === 'metadata' ? 'Loading details of' : 'Loading';
  return progress.total > 0
    ? `${what} ${progress.loaded.toLocaleString()} of ${items(progress.total)}…`
    : 'Loading items…';
}
