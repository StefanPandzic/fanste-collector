import { addItemInputSchema, providerLabel } from '@fanste/core';

import {
  cleanDetails,
  copyFieldErrors,
  parseAmount,
  parseCount,
  showsCopyDetails,
  showsDigitalStore,
  showsFileFormat,
} from '@/features/copy-form/copy-form';

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

export type AddItemFormResult =
  { ok: true; input: AddItemInput } | { ok: false; errors: Record<string, string> };

/**
 * Converts the form into the input of `useAddItem`, or field errors (keyed like
 * `COPY_FIELD_MESSAGES`). Statuses without copy details (`wishlist`, `sold`) save no medium and no
 * details. Amounts are in `currency`, the user's default currency.
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
  return { ok: false, errors: copyFieldErrors(parsed.error.issues) };
}
