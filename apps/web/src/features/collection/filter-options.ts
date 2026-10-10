import type { CopyOption } from '@fanste/core';

/** One value of a gallery filter, e.g. `{ value: 'DVD', label: 'DVD', count: 42 }`. */
export interface FilterOption {
  value: string;
  label: string;
  /** Matching items with this value; `undefined` while the counts load. */
  count?: number;
}

/**
 * The values a filter offers: the suggested `known` values first (in their order), then other values
 * found in the collection (free-text "Other" media, editions, ...) by count. Values no item has are
 * hidden unless selected, so the list only shows what narrows the gallery. Before the counts have
 * loaded, all known values are offered.
 */
export function filterOptions(
  known: readonly CopyOption[],
  counts: Readonly<Record<string, number>> | undefined,
  selected: readonly string[] = [],
  labelOf: (value: string) => string = (value) => value,
): FilterOption[] {
  const knownValues = new Set(known.map((option) => option.value));
  const options: FilterOption[] = known
    .filter(
      (option) => !counts || (counts[option.value] ?? 0) > 0 || selected.includes(option.value),
    )
    .map((option) => ({
      value: option.value,
      label: option.label,
      count: counts?.[option.value] ?? (counts ? 0 : undefined),
    }));

  const others = Object.entries(counts ?? {})
    .filter(([value]) => !knownValues.has(value))
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .map(([value, count]) => ({ value, label: labelOf(value), count }));
  // A selected value no item has any more (e.g. from a bookmark) stays visible, so it can be cleared.
  const missing = selected
    .filter((value) => !knownValues.has(value) && !(counts && value in counts))
    .map((value) => ({ value, label: labelOf(value), count: counts ? 0 : undefined }));
  return [...options, ...others, ...missing];
}
