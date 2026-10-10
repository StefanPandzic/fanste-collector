import { applyOverrides, copyBadges, ITEM_SOURCES } from '@fanste/core';

import type { ItemCardData } from '@/components/items/item-card';

import type { CollectionItem, ItemSource } from '@fanste/core';

/** A collection item as the gallery shows it, in the grid and the list. */
export interface GalleryItem {
  id: string;
  card: ItemCardData & { badges: readonly string[] };
  subtitle?: string;
  format: string | null;
  acquiredAt: string | null;
  estimatedValue: number | null;
  currency: string | null;
}

/** Shown until an item's metadata has been loaded through the gateway. */
export const LOADING_TITLE = 'Loading…';

/** The displayed values of a collection item: provider metadata with the user's overrides. */
export function toGalleryItem(item: CollectionItem): GalleryItem {
  const overrides = item.metadataOverrides;
  const display = item.metadata ? applyOverrides(item.metadata, overrides).item : undefined;
  return {
    id: item.id,
    card: {
      title: display?.title ?? overrides.title ?? LOADING_TITLE,
      category: item.category,
      releaseYear: display?.releaseYear ?? overrides.releaseYear,
      imageUrl: display?.imageUrl ?? overrides.imageUrl,
      thumbnailUrl: display?.thumbnailUrl ?? overrides.imageUrl,
      ownership: item.ownership,
      coverUnoptimized: overrides.imageUrl !== undefined,
      badges: copyBadges(item.category, item.format, item.details, item.metadata?.extra),
    },
    subtitle: display?.subtitle ?? overrides.subtitle,
    format: item.format,
    acquiredAt: item.acquiredAt,
    estimatedValue: item.estimatedValue,
    currency: item.currency,
  };
}

export const SOURCE_LABELS: Record<ItemSource, string> = {
  manual: 'Added by hand',
  search: 'From search',
  scanner: 'From scanner',
};

export const SOURCE_OPTIONS = ITEM_SOURCES.map((source) => ({
  value: source,
  label: SOURCE_LABELS[source],
}));

/** e.g. `€12.50`; without a currency just the number. */
export function formatMoney(amount: number, currency: string | null, locale?: string): string {
  if (!currency) return amount.toLocaleString(locale, { maximumFractionDigits: 2 });
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    // Not a currency Intl knows.
    return `${amount.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;
  }
}

/** A `YYYY-MM-DD` date as the user's locale writes it, e.g. `May 1, 2024`. */
export function formatDate(date: string, locale?: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}
