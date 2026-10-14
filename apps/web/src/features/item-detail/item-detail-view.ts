import {
  applyOverrides,
  detailsPatchSchemaFor,
  FILE_DETAIL_FIELDS,
  fileDetailOrigin,
  languageLabel,
  overridesPatchSchema,
  parseMovieExtra,
  parseMusicExtra,
  parseTvExtra,
  parseVideoGameExtra,
  providerLabel,
  updateItemPatchSchema,
} from '@fanste/core';

import {
  copyFieldMessage,
  isEmptyValue,
  parseAmount,
  parseCount,
} from '@/features/copy-form/copy-form';
import type { CopyFormDetails } from '@/features/copy-form/copy-form';

import type {
  CollectionItem,
  DetailsPatch,
  FileDetailField,
  FileDetails,
  ItemCategory,
  MetadataProvider,
  MusicFormatInfo,
  MusicMatrix,
  MusicTrack,
  NormalizedItem,
  OverridableField,
  OverridesPatch,
  OwnershipStatus,
  UpdateItemPatch,
} from '@fanste/core';

// What the item page (FC-19) shows and how its fields turn into saves. Every field saves on its own
// (per-field autosave), so each converter takes the changed fields only and returns a patch of the
// valid ones plus an error for each invalid one.

/** Changes of some fields, split into the valid ones (`patch`) and errors keyed by field. */
export interface FieldChanges<P> {
  patch: P;
  errors: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------------------------------

export interface ItemDetailView {
  /** The provider metadata with the user's overrides; `undefined` while it isn't loaded. */
  display: NormalizedItem | undefined;
  /** The provider metadata without overrides, for the "original value" hints. */
  original: NormalizedItem | undefined;
  overridden: ReadonlySet<OverridableField>;
  title: string;
  /** A user-entered cover loads without the image optimizer (FC-15 Notes). */
  coverUnoptimized: boolean;
}

/** Shown until the item's metadata has been loaded. */
export const LOADING_TITLE = 'Loading…';

/**
 * The item as the page shows it. `providerItem` (from the gateway) fills in while the collection row
 * has no cached metadata yet.
 */
export function toItemDetailView(
  item: CollectionItem,
  providerItem?: NormalizedItem,
): ItemDetailView {
  const original = item.metadata ?? providerItem;
  const overrides = item.metadataOverrides;
  const applied = original ? applyOverrides(original, overrides) : undefined;
  return {
    display: applied?.item,
    original,
    overridden: new Set(applied?.overridden ?? []),
    title: applied?.item.title ?? overrides.title ?? LOADING_TITLE,
    coverUnoptimized: overrides.imageUrl !== undefined,
  };
}

/** e.g. `2 h 28 min`, `45 min`. */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The heading of the creators: who `creators` are for the category. */
export function creatorsLabel(category: ItemCategory): string {
  if (category === 'music') return 'Artists';
  if (category === 'video_game') return 'Developed by';
  return category === 'tv' ? 'Created by' : 'Directed by';
}

/**
 * Whether the creators line adds anything: a record's artists and a game's developers are usually
 * its subtitle already.
 */
export function showsCreators(item: NormalizedItem): boolean {
  if (!item.creators || item.creators.length === 0) return false;
  if (item.category !== 'music' && item.category !== 'video_game') return true;
  return item.creators.join(', ') !== item.subtitle;
}

/** A release's formats, e.g. `2×Vinyl, LP, Album, Red` (`+` between formats of a box set). */
export function formatSummary(formats: readonly MusicFormatInfo[]): string {
  return formats
    .map((format) =>
      [
        `${format.quantity && format.quantity > 1 ? `${format.quantity}×` : ''}${format.name}`,
        ...(format.descriptions ?? []),
        ...(format.text ? [format.text] : []),
      ].join(', '),
    )
    .join(' + ');
}

/** A record's tracks (FC-10); empty for other categories. */
export function tracklistOf(item: NormalizedItem): MusicTrack[] {
  return item.category === 'music' ? (parseMusicExtra(item.extra)?.tracklist ?? []) : [];
}

/** A record's matrix / runout codes (FC-10); empty for other categories. */
export function matrixCodesOf(item: NormalizedItem): MusicMatrix[] {
  return item.category === 'music' ? (parseMusicExtra(item.extra)?.matrix ?? []) : [];
}

export interface MediaFact {
  label: string;
  value: string;
}

/**
 * The category's own facts (runtime, seasons, status, label, platforms, ...). Board games and Funko
 * get theirs with FC-12 / FC-13. A record's matrix codes and tracklist are lists of their own
 * (`matrixCodesOf`, `tracklistOf`).
 */
export function mediaFacts(item: NormalizedItem): MediaFact[] {
  const facts: MediaFact[] = [];
  const add = (label: string, value: string | undefined) => {
    if (value) facts.push({ label, value });
  };
  if (item.category === 'movie') {
    const extra = parseMovieExtra(item.extra);
    add('Runtime', extra?.runtimeMinutes ? formatRuntime(extra.runtimeMinutes) : undefined);
    add('Original title', extra?.originalTitle);
    add('Original language', extra?.originalLanguage && languageLabel(extra.originalLanguage));
  } else if (item.category === 'tv') {
    const extra = parseTvExtra(item.extra);
    add('Seasons', extra?.seasonCount?.toString());
    add('Episodes', extra?.episodeCount?.toString());
    add(
      'Episode runtime',
      extra?.episodeRuntimeMinutes ? formatRuntime(extra.episodeRuntimeMinutes) : undefined,
    );
    add('Status', extra?.status);
    add('Network', extra?.networks?.join(', '));
    add('Original title', extra?.originalTitle);
    add('Original language', extra?.originalLanguage && languageLabel(extra.originalLanguage));
  } else if (item.category === 'music') {
    const extra = parseMusicExtra(item.extra);
    const labels = [...new Set(extra?.labels?.map((label) => label.name))];
    add(labels.length > 1 ? 'Labels' : 'Label', labels.join(', '));
    add('Catalog number', extra?.catalogNumber);
    add('Country', extra?.country);
    add('Format', extra?.formats && formatSummary(extra.formats));
    add(
      extra?.barcodes && extra.barcodes.length > 1 ? 'Barcodes' : 'Barcode',
      extra?.barcodes?.join(', '),
    );
    if (extra?.discogsType === 'master') add('Release', 'All pressings (master release)');
  } else if (item.category === 'video_game') {
    const extra = parseVideoGameExtra(item.extra);
    const platforms = extra?.platforms ?? [];
    add(
      platforms.length > 1 ? 'Platforms' : 'Platform',
      platforms.map((platform) => platform.name).join(', '),
    );
    const developers = item.creators ?? [];
    add(developers.length > 1 ? 'Developers' : 'Developer', developers.join(', '));
    const publishers = extra?.publishers ?? [];
    add(publishers.length > 1 ? 'Publishers' : 'Publisher', publishers.join(', '));
    if (extra?.gameType && extra.gameType !== 'Main Game') add('Type', extra.gameType);
  }
  return facts;
}

/** The "edited" hint of an overridden field: the provider's own value. */
export function originalValueText(
  field: OverridableField,
  original: NormalizedItem | undefined,
  provider: MetadataProvider,
): string {
  const value = original?.[field];
  const source = providerLabel(provider);
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    return `No value from ${source}`;
  }
  if (field === 'imageUrl') return `Original: the ${source} cover`;
  const text = Array.isArray(value) ? value.join(', ') : String(value);
  return `Original: ${text.length > 160 ? `${text.slice(0, 159)}…` : text}`;
}

// ---------------------------------------------------------------------------------------------------
// My copy (the `collection_items` columns)
// ---------------------------------------------------------------------------------------------------

/** The copy fields as the form holds them: text inputs keep strings until they're saved. */
export interface CopyFieldValues {
  ownership: OwnershipStatus;
  quantity: string;
  /** `YYYY-MM-DD` or empty. */
  acquiredAt: string;
  purchasePrice: string;
  estimatedValue: string;
  /** ISO 4217 code, empty for none. */
  currency: string;
  notes: string;
  /** Medium, empty for none. */
  format: string;
}

function amountText(value: number | null): string {
  return value === null ? '' : String(value);
}

export function copyFieldValues(item: CollectionItem): CopyFieldValues {
  return {
    ownership: item.ownership,
    quantity: String(item.quantity),
    acquiredAt: item.acquiredAt ?? '',
    purchasePrice: amountText(item.purchasePrice),
    estimatedValue: amountText(item.estimatedValue),
    currency: item.currency ?? '',
    notes: item.notes ?? '',
    format: item.format ?? '',
  };
}

function copyFieldValue(field: keyof CopyFieldValues, value: string): unknown {
  switch (field) {
    case 'quantity':
      return parseCount(value);
    case 'purchasePrice':
    case 'estimatedValue':
      return parseAmount(value);
    case 'acquiredAt':
    case 'currency':
      return value.trim() || null;
    default:
      return value;
  }
}

/**
 * Converts changed copy fields into an `UpdateItemPatch`. A price or value set on a copy without a
 * currency also sets `defaultCurrency`, so the amount means something.
 */
export function toCopyPatch(
  changes: Partial<CopyFieldValues>,
  current: Pick<CollectionItem, 'currency'>,
  defaultCurrency: string,
): FieldChanges<UpdateItemPatch> {
  const patch: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(changes) as [keyof CopyFieldValues, string][]) {
    const converted = copyFieldValue(field, value);
    if (updateItemPatchSchema.safeParse({ [field]: converted }).success) patch[field] = converted;
    else errors[field] = copyFieldMessage(field);
  }
  const setsAmount = [patch.purchasePrice, patch.estimatedValue].some(
    (amount) => amount !== undefined && amount !== null,
  );
  if (setsAmount && current.currency === null && patch.currency === undefined) {
    patch.currency = defaultCurrency;
  }
  return { patch: patch, errors };
}

// ---------------------------------------------------------------------------------------------------
// Copy details (`details` jsonb)
// ---------------------------------------------------------------------------------------------------

/** Categories whose copy details the item page edits. */
export type DetailsCategory = 'movie' | 'tv' | 'music' | 'video_game';

/** The copy-details form of a category; board games keep the movie form until FC-12. */
export function detailsCategory(category: ItemCategory): DetailsCategory {
  return category === 'tv' || category === 'music' || category === 'video_game'
    ? category
    : 'movie';
}

/**
 * Converts changed copy details into a details patch: an empty value (blank, empty list) removes
 * the field (`null`). Errors are keyed `details.<field>`, like the copy-details form shows them.
 */
export function toDetailsPatch(
  category: DetailsCategory,
  changes: Partial<CopyFormDetails>,
): FieldChanges<DetailsPatch<DetailsCategory>> {
  const schema = detailsPatchSchemaFor(category);
  const patch: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(changes) as [keyof CopyFormDetails, unknown][]) {
    if (category === 'movie' && field === 'seasons') continue;
    const converted = isEmptyValue(value) ? null : value;
    if (schema.safeParse({ [field]: converted }).success) patch[field] = converted;
    else errors[`details.${field}`] = copyFieldMessage(`details.${field}`);
  }
  return { patch: patch, errors };
}

// ---------------------------------------------------------------------------------------------------
// Metadata overrides
// ---------------------------------------------------------------------------------------------------

/** The overridable fields as the "Edit metadata" form holds them. */
export interface OverrideFieldValues {
  title: string;
  subtitle: string;
  releaseYear: string;
  imageUrl: string;
  description: string;
  /** Comma-separated, e.g. `Drama, Crime`. */
  genres: string;
  /** Comma-separated. */
  creators: string;
}

export function overrideFieldValues(display: NormalizedItem | undefined): OverrideFieldValues {
  return {
    title: display?.title ?? '',
    subtitle: display?.subtitle ?? '',
    releaseYear: display?.releaseYear?.toString() ?? '',
    imageUrl: display?.imageUrl ?? '',
    description: display?.description ?? '',
    genres: display?.genres?.join(', ') ?? '',
    creators: display?.creators?.join(', ') ?? '',
  };
}

const OVERRIDE_MESSAGES: Record<OverridableField, string> = {
  title: 'Enter a title of at most 500 characters.',
  subtitle: 'The subtitle can be at most 500 characters.',
  releaseYear: 'Enter a year from 1 to 9999.',
  imageUrl: 'Enter an https:// image address.',
  description: 'The description can be at most 10,000 characters.',
  genres: 'Use at most 50 genres of up to 200 characters.',
  creators: 'Use at most 50 names of up to 200 characters.',
};

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => entry === b[index]);
  }
  return a === b;
}

function overrideValue(field: OverridableField, value: string): unknown {
  if (field === 'genres' || field === 'creators') return parseNameList(value);
  const trimmed = value.trim();
  if (field === 'releaseYear') return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  return trimmed;
}

/**
 * Converts changed metadata fields into an overrides patch. A value equal to the provider's, or an
 * empty one, resets the field (`null`): the item then shows the provider's value again. The title
 * can't be emptied.
 */
export function toOverridesPatch(
  changes: Partial<OverrideFieldValues>,
  original: NormalizedItem | undefined,
): FieldChanges<OverridesPatch> {
  const patch: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [field, raw] of Object.entries(changes) as [OverridableField, string][]) {
    const value = overrideValue(field, raw);
    if (isEmptyValue(value)) {
      if (field === 'title') errors.title = 'The title can’t be empty.';
      else patch[field] = null;
      continue;
    }
    if (sameValue(value, original?.[field])) {
      patch[field] = null;
      continue;
    }
    if (overridesPatchSchema.safeParse({ [field]: value }).success) patch[field] = value;
    else errors[field] = OVERRIDE_MESSAGES[field];
  }
  return { patch: patch, errors };
}

/** Splits a typed list (`Drama, Crime`) into its names. */
export function parseNameList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------------------------------
// Copy details from the file itself (FC-23)
// ---------------------------------------------------------------------------------------------------

/** Label of the marker of a detail that is still what the file's headers said. */
export const FROM_FILE_LABEL = 'from file';

/**
 * The marker of a copy detail the scanner took from the file's own headers (`file_details`):
 * `file` while it still has that value, `edited` (with the file's value) once the user changed or
 * cleared it. `undefined` for fields nothing was recorded for.
 */
export type FileMarker =
  { kind: 'file' } | { kind: 'edited'; fileValue: string | string[]; hint: string };

export function fileMarkerOf(
  field: string,
  stored: unknown,
  recorded: FileDetails,
): FileMarker | undefined {
  if (!(FILE_DETAIL_FIELDS as readonly string[]).includes(field)) return undefined;
  const fileValue = recorded[field as FileDetailField];
  const origin = fileDetailOrigin(stored, fileValue);
  if (!origin || fileValue === undefined) return undefined;
  if (origin === 'file') return { kind: 'file' };
  const text = Array.isArray(fileValue)
    ? fileValue.map((code) => languageLabel(code)).join(', ')
    : fileValue;
  return { kind: 'edited', fileValue, hint: `File: ${text}` };
}
