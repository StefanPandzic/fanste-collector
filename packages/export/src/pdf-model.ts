import { copyBadges, providerLabel, VALUED_STATUSES } from '@fanste/core';

import { formatSeasons, toExportRow } from './columns';
import { groupForExport } from './groups';

import type { ExportRow } from './columns';
import type { ExportGroupKey } from './groups';
import type {
  CollectionItem,
  CustomCollection,
  ItemCategory,
  MetadataProvider,
  OwnershipStatus,
  TvSeasonDetails,
} from '@fanste/core';

// What the PDF catalog prints (FC-26), worked out without jsPDF so it can be tested on its own.

/** A grid of covers, or a table for insurance with values and totals. */
export const PDF_LAYOUTS = ['grid', 'insurance'] as const;
export type PdfLayout = (typeof PDF_LAYOUTS)[number];

export const PDF_LAYOUT_LABELS: Record<PdfLayout, string> = {
  grid: 'Catalog',
  insurance: 'Insurance list',
};

/** Shown for an item whose metadata couldn't be loaded and that has no title of its own. */
export const UNTITLED = 'Untitled';

/** Joins the parts of one line, e.g. `4K UHD · Steelbook`. */
export const DETAIL_SEPARATOR = ' · ';

/** One copy, as the catalog prints it. */
export interface PdfEntry {
  id: string;
  category: ItemCategory;
  provider: MetadataProvider;
  /** The title with the user's override. */
  title: string;
  /** Subtitle (artist, developer, ...) and year, e.g. `Radiohead · 1997`. */
  byline?: string;
  format?: string;
  /** The gallery's badges of the copy, e.g. `4K UHD · Steelbook` or `PS5 · Disc`. */
  badges?: string;
  /** The facts an insurer asks about: edition, discs, platform, storefront, condition, ... */
  details?: string;
  /** The custom cover, else the provider's (thumbnail first). */
  coverUrl?: string;
  ownership: OwnershipStatus;
  quantity: number;
  acquiredAt: string | null;
  purchasePrice: number | null;
  /** The value of one copy. */
  estimatedValue: number | null;
  /** `estimatedValue × quantity`; `null` without a value. */
  lineValue: number | null;
  currency: string | null;
  /** Whether the entry counts towards the value totals (`VALUED_STATUSES`, the dashboard's rule). */
  valued: boolean;
}

/** A value total in one currency (`null`: values without a currency). Never converted. */
export interface MoneyTotal {
  currency: string | null;
  total: number;
}

/** One category or custom collection, with a heading. */
export interface PdfSection {
  key: ExportGroupKey;
  label: string;
  /** Sorted by title. */
  entries: PdfEntry[];
  /** The section's estimated value per currency, largest first. */
  totals: MoneyTotal[];
}

export interface PdfModel {
  layout: PdfLayout;
  sections: PdfSection[];
  /** Entries printed. */
  itemCount: number;
  /** The whole export's estimated value per currency, largest first. */
  totals: MoneyTotal[];
  /** The metadata providers of the entries, in the app's order (for the attribution). */
  providers: MetadataProvider[];
}

export interface PdfModelOptions {
  layout: PdfLayout;
  /** The user's custom collections, for the section names and order (FC-13). */
  collections: readonly CustomCollection[];
}

const ATTRIBUTED_PROVIDERS: readonly MetadataProvider[] = ['tmdb', 'discogs', 'igdb', 'bgg'];

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function joinParts(parts: readonly (string | number | undefined)[]): string | undefined {
  const present = parts.filter((part) => part !== undefined && part !== '');
  return present.length > 0 ? present.join(DETAIL_SEPARATOR) : undefined;
}

function discs(value: unknown): string | undefined {
  return typeof value === 'number' && value > 1 ? `${value} discs` : undefined;
}

/** A disc region, e.g. `Region B` (stored as `B`) or `Region-free`. */
function discRegion(value: unknown): string | undefined {
  const region = text(value);
  return region === undefined || region.startsWith('Region') ? region : `Region ${region}`;
}

/** A special edition; `Standard` says nothing. */
function edition(value: unknown): string | undefined {
  const name = text(value);
  return name === 'Standard' ? undefined : name;
}

/**
 * The details an insurance list needs to tell a copy apart, e.g. `Steelbook · 2 discs · Region B`
 * or `PS5 · Steam · Collector's Edition · CIB`. The medium is in its own column.
 */
export function insuranceDetails(category: ItemCategory, details: Record<string, unknown>) {
  switch (category) {
    case 'movie':
    case 'tv':
      return joinParts([
        edition(details.edition),
        discs(details.discCount),
        discRegion(details.region),
        text(details.digitalStore),
        category === 'tv'
          ? formatSeasons(details.seasons as TvSeasonDetails[] | undefined)
          : undefined,
      ]);
    case 'music':
      return joinParts([
        text(details.vinylSize),
        text(details.variant),
        discs(details.discCount),
        text(details.catalogNumber) && `Cat. ${text(details.catalogNumber)}`,
        text(details.mediaCondition) && `Media ${text(details.mediaCondition)}`,
        text(details.sleeveCondition) && `Sleeve ${text(details.sleeveCondition)}`,
      ]);
    case 'video_game':
      return joinParts([
        text(details.platform),
        text(details.storefront),
        edition(details.edition),
        discs(details.discCount),
        text(details.region),
        text(details.completeness),
      ]);
    case 'custom':
      return joinParts([
        text(details.variant),
        text(details.condition),
        typeof details.boxed === 'boolean' ? (details.boxed ? 'Boxed' : 'Loose') : undefined,
      ]);
    default:
      return undefined;
  }
}

function toEntry(row: ExportRow): PdfEntry {
  const { item, display } = row;
  const title = text(display?.title) ?? text(item.metadataOverrides.title) ?? UNTITLED;
  const year = display?.releaseYear ?? item.metadataOverrides.releaseYear;
  const badges = copyBadges(item.category, item.format, item.details, item.metadata?.extra);
  const lineValue = item.estimatedValue === null ? null : item.estimatedValue * item.quantity;
  return {
    id: item.id,
    category: item.category,
    provider: item.provider,
    title,
    byline: joinParts([text(display?.subtitle), year]),
    format: text(item.format),
    badges: joinParts(badges),
    details: insuranceDetails(item.category, row.details),
    coverUrl:
      text(display?.thumbnailUrl) ??
      text(display?.imageUrl) ??
      // A custom cover still shows when the provider's metadata couldn't be loaded.
      text(item.metadataOverrides.imageUrl),
    ownership: item.ownership,
    quantity: item.quantity,
    acquiredAt: item.acquiredAt,
    purchasePrice: item.purchasePrice,
    estimatedValue: item.estimatedValue,
    lineValue,
    currency: item.currency,
    valued: VALUED_STATUSES.includes(item.ownership),
  };
}

/**
 * The estimated value of the valued entries per currency, largest first. Summed in whole cents, so
 * it matches the database's exact sum behind the dashboard's total.
 */
export function valueTotals(entries: readonly PdfEntry[]): MoneyTotal[] {
  const cents = new Map<string | null, number>();
  for (const entry of entries) {
    if (!entry.valued || entry.estimatedValue === null) continue;
    const value = Math.round(entry.estimatedValue * 100) * entry.quantity;
    cents.set(entry.currency, (cents.get(entry.currency) ?? 0) + value);
  }
  return [...cents]
    .filter(([, total]) => total > 0)
    .map(([currency, total]) => ({ currency, total: total / 100 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * The catalog of `items`: one section per category and custom collection, in the app's order,
 * entries sorted by title. The insurance list keeps only the copies the user has.
 */
export function buildPdfModel(
  items: readonly CollectionItem[],
  { layout, collections }: PdfModelOptions,
): PdfModel {
  const kept =
    layout === 'insurance'
      ? items.filter((item) => VALUED_STATUSES.includes(item.ownership))
      : items;
  const context = {
    tagNames: new Map<string, string>(),
    collectionNames: new Map(collections.map((collection) => [collection.id, collection.name])),
  };
  const sections = groupForExport(kept, collections).map((group) => {
    const entries = group.items
      .map((item) => toEntry(toExportRow(item, context)))
      .sort((a, b) => a.title.localeCompare(b.title));
    return { key: group.key, label: group.label, entries, totals: valueTotals(entries) };
  });
  const entries = sections.flatMap((section) => section.entries);
  const used = new Set(entries.map((entry) => entry.provider));
  return {
    layout,
    sections,
    itemCount: entries.length,
    totals: valueTotals(entries),
    providers: ATTRIBUTED_PROVIDERS.filter((provider) => used.has(provider)),
  };
}

/** The provider names for the footer, e.g. `Metadata: TMDB · Discogs`; `undefined` without any. */
export function attributionLine(providers: readonly MetadataProvider[]): string | undefined {
  if (providers.length === 0) return undefined;
  return `Metadata: ${providers.map(providerLabel).join(DETAIL_SEPARATOR)}`;
}

/** The distinct cover URLs of a grid catalog, in print order. */
export function coverUrls(model: PdfModel): string[] {
  if (model.layout !== 'grid') return [];
  const urls = new Set<string>();
  for (const section of model.sections) {
    for (const entry of section.entries) if (entry.coverUrl) urls.add(entry.coverUrl);
  }
  return [...urls];
}

/** Every text of the model the PDF prints, to pick its fonts (`fontNeeds`). */
export function modelTexts(model: PdfModel): string[] {
  return model.sections.flatMap((section) => [
    section.label,
    ...section.entries.flatMap((entry) =>
      [entry.title, entry.byline, entry.format, entry.badges, entry.details].filter(
        (value) => value !== undefined,
      ),
    ),
  ]);
}
