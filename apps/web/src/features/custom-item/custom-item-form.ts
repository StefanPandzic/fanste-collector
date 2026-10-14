import {
  addCustomItemInputSchema,
  customItemDataPatchSchema,
  customItemDataShape,
  MAX_CUSTOM_CREATORS,
} from '@fanste/core';

import {
  cleanDetails,
  copyFieldErrors,
  parseAmount,
  parseCount,
  showsCopyDetails,
  shownDetails,
} from '@/features/copy-form/copy-form';
import type { AddItemFormValues } from '@/features/search/add-item-form';

import type {
  AddCustomItemInput,
  CustomItemData,
  CustomItemDataPatch,
  CustomItemField,
  ItemCategory,
} from '@fanste/core';

// The fields of a hand-entered item (FC-13), as the add form and the item page hold them: text
// inputs keep strings until they're converted.

export interface CustomItemFieldValues {
  title: string;
  subtitle: string;
  identifier: string;
  releaseYear: string;
  /** Names separated by commas. */
  creators: string;
  description: string;
  imageUrl: string;
}

export const EMPTY_CUSTOM_ITEM_FIELDS: CustomItemFieldValues = {
  title: '',
  subtitle: '',
  identifier: '',
  releaseYear: '',
  creators: '',
  description: '',
  imageUrl: '',
};

/** Messages per item field, keyed `item.<field>`. */
export const CUSTOM_ITEM_FIELD_MESSAGES: Readonly<Record<CustomItemField, string>> = {
  title: 'Enter a title of at most 200 characters.',
  subtitle: 'The series can be at most 200 characters.',
  identifier: 'The number can be at most 50 characters.',
  releaseYear: 'Enter a year from 1 to 9999.',
  creators: `Enter at most ${MAX_CUSTOM_CREATORS} names of at most 100 characters, separated by commas.`,
  description: 'The description can be at most 5000 characters.',
  imageUrl: 'Enter an https:// address, or upload a photo.',
};

/** The form values of stored item data. */
export function customItemFieldValues(data: CustomItemData | null): CustomItemFieldValues {
  if (!data) return { ...EMPTY_CUSTOM_ITEM_FIELDS };
  return {
    title: data.title,
    subtitle: data.subtitle ?? '',
    identifier: data.identifier ?? '',
    releaseYear: data.releaseYear?.toString() ?? '',
    creators: data.creators?.join(', ') ?? '',
    description: data.description ?? '',
    imageUrl: data.imageUrl ?? '',
  };
}

/** `Hasbro, Funko` → `['Hasbro', 'Funko']`; blank names are dropped. */
export function parseCreators(value: string): string[] {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

/** One typed field as stored: `undefined` when empty, `NaN` for a year that isn't a number. */
function convertField(field: CustomItemField, value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (field === 'releaseYear') return /^\d{1,4}$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (field === 'creators') {
    const names = parseCreators(trimmed);
    return names.length > 0 ? names : undefined;
  }
  return trimmed;
}

/**
 * Changed item fields as a `custom_data` patch: an emptied field is removed (`null`); an emptied
 * title is an error, since every item needs one. Errors are keyed `item.<field>`.
 */
export function toCustomItemDataPatch(changes: Partial<CustomItemFieldValues>): {
  patch: CustomItemDataPatch;
  errors: Record<string, string>;
} {
  const patch: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(changes) as [CustomItemField, string][]) {
    const converted = convertField(field, value);
    if (converted === undefined) {
      if (field === 'title') errors['item.title'] = CUSTOM_ITEM_FIELD_MESSAGES.title;
      else patch[field] = null;
    } else if (customItemDataPatchSchema.safeParse({ [field]: converted }).success) {
      patch[field] = converted;
    } else {
      errors[`item.${field}`] = CUSTOM_ITEM_FIELD_MESSAGES[field];
    }
  }
  return { patch: patch, errors };
}

/** The add form of a hand-entered item: its own fields and the copy fields. */
export interface CustomItemFormValues extends AddItemFormValues {
  item: CustomItemFieldValues;
}

/** Where a new hand-entered item goes. */
export interface CustomItemTarget {
  category: ItemCategory;
  /** The custom collection of a `custom` item; `null` for "Add manually" in another category. */
  customCollectionId: string | null;
}

export function initialCustomItemForm(format = ''): CustomItemFormValues {
  return {
    item: { ...EMPTY_CUSTOM_ITEM_FIELDS },
    ownership: 'owned',
    quantity: '1',
    acquiredAt: '',
    purchasePrice: '',
    estimatedValue: '',
    notes: '',
    format,
    details: {},
  };
}

export type CustomItemFormResult =
  { ok: true; input: AddCustomItemInput } | { ok: false; errors: Record<string, string> };

/**
 * Converts the add form into the input of `useAddCustomItem`, or field errors (item fields keyed
 * `item.<field>`, copy fields like `COPY_FIELD_MESSAGES`). Statuses without copy details save no
 * medium and no details. Amounts are in `currency`, the user's default currency.
 */
export function toAddCustomItemInput(
  values: CustomItemFormValues,
  target: CustomItemTarget,
  currency: string,
): CustomItemFormResult {
  const customData = Object.fromEntries(
    (Object.keys(customItemDataShape) as CustomItemField[])
      .map((field) => [field, convertField(field, values.item[field])] as const)
      .filter(([, value]) => value !== undefined),
  );
  const purchasePrice = parseAmount(values.purchasePrice);
  const estimatedValue = parseAmount(values.estimatedValue);
  const copy = showsCopyDetails(values.ownership);
  const raw = {
    category: target.category,
    customCollectionId: target.customCollectionId,
    customData: customData as CustomItemData,
    ownership: values.ownership,
    quantity: parseCount(values.quantity),
    acquiredAt: values.acquiredAt.trim() || null,
    purchasePrice,
    estimatedValue,
    currency: purchasePrice !== null || estimatedValue !== null ? currency : null,
    notes: values.notes,
    format: copy ? values.format : null,
    ...(copy
      ? { details: cleanDetails(shownDetails(target.category, values.format, values.details)) }
      : {}),
  } satisfies AddCustomItemInput;

  const parsed = addCustomItemInputSchema.safeParse(raw);
  if (parsed.success) return { ok: true, input: raw };

  const itemIssues = parsed.error.issues.filter((issue) => issue.path[0] === 'customData');
  const errors = copyFieldErrors(
    parsed.error.issues.filter((issue) => issue.path[0] !== 'customData'),
  );
  for (const issue of itemIssues) {
    const field = issue.path[1] as CustomItemField | undefined;
    // A missing title, or the size limit of the whole object (reported on the title).
    const key = field && field in CUSTOM_ITEM_FIELD_MESSAGES ? field : 'title';
    errors[`item.${key}`] ??= CUSTOM_ITEM_FIELD_MESSAGES[key];
  }
  return { ok: false, errors };
}
