import { CATEGORY_META, COPY_DETAIL_STATUSES, ITEM_CATEGORIES } from '@fanste/core';

import { DEFAULT_SORT, galleryStateUrl } from '@/features/collection/gallery-state';
import { isSearchable } from '@/features/search/search-state';

import type { CollectionStats, MonthCount, ValueTotal } from '@fanste/collection';
import type { ItemCategory } from '@fanste/core';
import type { Route } from 'next';

/** The estimated value: the total in the default currency, and totals in other currencies apart. */
export interface ValueSummary {
  /** In the user's default currency (0 when nothing is valued in it). */
  main: ValueTotal;
  /** Values in other currencies, largest first. They aren't converted: there are no FX rates. */
  others: ValueTotal[];
}

export function valueSummary(stats: CollectionStats, currency: string): ValueSummary {
  return {
    main: stats.estimatedValue.find((value) => value.currency === currency) ?? {
      currency,
      total: 0,
    },
    others: stats.estimatedValue.filter((value) => value.currency !== currency),
  };
}

export interface CategoryCardView {
  category: ItemCategory;
  label: string;
  /** Copies the user has in the category. */
  count: number;
  /** The gallery filtered to the category and the statuses `count` covers. */
  href: Route;
  /** False for categories whose provider isn't built yet and that hold no items ("Coming soon"). */
  available: boolean;
}

/** One card per category, in the order of `ITEM_CATEGORIES`. */
export function categoryCards(stats: CollectionStats): CategoryCardView[] {
  return ITEM_CATEGORIES.map((category) => {
    const count = stats.inCollectionByCategory[category].items;
    return {
      category,
      label: CATEGORY_META[category].pluralLabel,
      count,
      href: galleryStateUrl({
        filter: { category, ownership: [...COPY_DETAIL_STATUSES] },
        sort: DEFAULT_SORT,
      }) as Route,
      available: isSearchable(category) || count > 0,
    };
  });
}

export interface BarView {
  key: string;
  /** Short axis label, e.g. `Oct`. */
  label: string;
  /** Full label for screen readers and tooltips, e.g. `October 2026: 4 items`. */
  description: string;
  value: number;
  /** Bar length as a share of the largest bar, 0–1. */
  ratio: number;
}

/** A `YYYY-MM` month, formatted in UTC so the month never shifts. */
function formatMonth(month: string, options: Intl.DateTimeFormatOptions, locale?: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (monthIndex ?? 1) - 1, 1)).toLocaleDateString(locale, {
    ...options,
    timeZone: 'UTC',
  });
}

const itemsLabel = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;

/** The "added per month" chart: one bar per month, oldest first. */
export function monthBars(months: readonly MonthCount[], locale?: string): BarView[] {
  const max = Math.max(0, ...months.map((month) => month.items));
  return months.map(({ month, items }) => ({
    key: month,
    label: formatMonth(month, { month: 'short' }, locale),
    description: `${formatMonth(month, { month: 'long', year: 'numeric' }, locale)}: ${itemsLabel(items)}`,
    value: items,
    ratio: max > 0 ? items / max : 0,
  }));
}

export interface CategoryValueView {
  category: ItemCategory;
  label: string;
  total: number;
  /** Share of the largest category's value, 0–1. */
  ratio: number;
}

/** Value per category in the default currency, largest first; categories without value left out. */
export function categoryValues(stats: CollectionStats, currency: string): CategoryValueView[] {
  const rows = ITEM_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_META[category].pluralLabel,
    total: stats.valueByCategory[category].find((value) => value.currency === currency)?.total ?? 0,
  }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const max = rows[0]?.total ?? 0;
  return rows.map((row) => ({ ...row, ratio: max > 0 ? row.total / max : 0 }));
}

/** A new user: nothing in the collection, not even on the wishlist. */
export function isEmptyCollection(stats: CollectionStats): boolean {
  return stats.totals.items === 0;
}
