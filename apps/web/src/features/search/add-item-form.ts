import { addItemInputSchema, COPY_DETAIL_STATUSES, providerLabel } from '@fanste/core';

import type {
  AddItemInput,
  ExternalProvider,
  ItemCategory,
  MetadataProvider,
  OwnershipStatus,
  PrefillResult,
  PrefillSource,
  SearchResult,
  TvDetails,
} from '@fanste/core';

/** The provider item a new copy is of. */
export interface AddTarget {
  category: ItemCategory;
  provider: ExternalProvider;
  externalId: string;
}

/**
 * The "Add with details" form. Text inputs hold strings until they're converted on submit. Movie and
 * TV details share one shape (`TvDetails` adds `seasons`); other categories get theirs with FC-10…
 */
export interface AddItemFormValues {
  ownership: OwnershipStatus;
  quantity: string;
  /** `YYYY-MM-DD` or empty. */
  acquiredAt: string;
  purchasePrice: string;
  estimatedValue: string;
  notes: string;
  /** Medium, empty for none. */
  format: string;
  details: TvDetails;
}

/** The add target of a search result; `undefined` for a custom item, which has no provider. */
export function targetOf(result: SearchResult): AddTarget | undefined {
  if (result.provider === 'custom') return undefined;
  return { category: result.category, provider: result.provider, externalId: result.externalId };
}

/** The marker of a prefilled field, e.g. `from TMDB` or `last used`. */
export function prefillLabel(source: PrefillSource, provider: MetadataProvider): string {
  if (source === 'provider') return `from ${providerLabel(provider)}`;
  if (source === 'scan') return 'from scan';
  return 'last used';
}

export function initialFormValues(prefill: PrefillResult): AddItemFormValues {
  return {
    ownership: 'owned',
    quantity: '1',
    acquiredAt: '',
    purchasePrice: '',
    estimatedValue: '',
    notes: '',
    format: prefill.format ?? '',
    details: { ...prefill.details },
  };
}

/** Whether the status is of a copy the user has, whose medium and details the form shows. */
export function showsCopyDetails(ownership: OwnershipStatus): boolean {
  return COPY_DETAIL_STATUSES.includes(ownership);
}

/** The container (`fileFormat`) only applies to a `Digital file` copy. */
export function showsFileFormat(format: string): boolean {
  return format === 'Digital file';
}

/** The store (`digitalStore`) only applies to a `Digital store` copy. */
export function showsDigitalStore(format: string): boolean {
  return format === 'Digital store';
}

/** Drops empty values: blank text, empty lists, `undefined`. */
export function cleanDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).filter(
      ([, value]) =>
        value !== undefined &&
        !(typeof value === 'string' && value.trim() === '') &&
        !(Array.isArray(value) && value.length === 0),
    ),
  );
}

/** An amount as typed (`12,50` or `12.50`); `NaN` when it isn't a number, so validation reports it. */
function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return /^\d+([.,]\d{1,2})?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

function parseCount(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
}

/** Messages per form field (top-level fields, and `details.<field>`). */
const FIELD_MESSAGES: Record<string, string> = {
  quantity: 'Enter a whole number from 1 to 9999.',
  acquiredAt: 'Enter a valid date.',
  purchasePrice: 'Enter an amount of 0 or more, with at most two decimals.',
  estimatedValue: 'Enter an amount of 0 or more, with at most two decimals.',
  notes: 'Notes can be at most 5000 characters.',
  format: 'The medium can be at most 100 characters.',
  'details.discCount': 'Enter a number of discs from 1 to 99.',
  'details.seasons': 'Pick at least one episode for each ticked season.',
};

export type AddItemFormResult =
  { ok: true; input: AddItemInput } | { ok: false; errors: Record<string, string> };

/**
 * Converts the form into the input of `useAddItem`, or field errors (keyed like `FIELD_MESSAGES`).
 * Statuses without copy details (`wishlist`, `sold`) save no medium and no details. Amounts are in
 * `currency`, the user's default currency.
 */
export function toAddItemInput(
  values: AddItemFormValues,
  target: AddTarget,
  currency: string,
): AddItemFormResult {
  const purchasePrice = parseAmount(values.purchasePrice);
  const estimatedValue = parseAmount(values.estimatedValue);
  const copy = showsCopyDetails(values.ownership);
  // Fields hidden for the chosen medium aren't saved.
  const { fileFormat, digitalStore, ...details } = values.details;
  const shownDetails = {
    ...details,
    ...(showsFileFormat(values.format) ? { fileFormat } : {}),
    ...(showsDigitalStore(values.format) ? { digitalStore } : {}),
  };
  const raw = {
    ...target,
    ownership: values.ownership,
    quantity: parseCount(values.quantity),
    acquiredAt: values.acquiredAt.trim() || null,
    purchasePrice,
    estimatedValue,
    currency: purchasePrice !== null || estimatedValue !== null ? currency : null,
    notes: values.notes,
    format: copy ? values.format : null,
    ...(copy ? { details: cleanDetails(shownDetails) } : {}),
    source: 'search',
  } satisfies AddItemInput;

  const parsed = addItemInputSchema.safeParse(raw);
  // `useAddItem` parses the input again (and the input type is what it takes), so the raw values go
  // through; this parse only checks them.
  if (parsed.success) return { ok: true, input: raw };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const [head, field] = issue.path.map(String);
    const key = head === 'details' && field ? `details.${field}` : (head ?? 'form');
    errors[key] ??= FIELD_MESSAGES[key] ?? 'Check this value.';
  }
  return { ok: false, errors };
}
