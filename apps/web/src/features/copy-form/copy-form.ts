import { COPY_DETAIL_STATUSES } from '@fanste/core';

import type { OwnershipStatus } from '@fanste/core';

// Form helpers shared by the "Add with details" dialog (FC-17) and the item page (FC-19).

/**
 * How a field reports a change: `immediate` for a pick (select, checkbox, list), which an autosaving
 * form saves at once; typed text waits for a pause.
 */
export interface ChangeOptions {
  immediate?: boolean;
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

/** Whether a form value counts as "not set": `undefined`, blank text or an empty list. */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Drops empty values: blank text, empty lists, `undefined`. */
export function cleanDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => !isEmptyValue(value)));
}

/** An amount as typed (`12,50` or `12.50`); `NaN` when it isn't a number, so validation reports it. */
export function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return /^\d+([.,]\d{1,2})?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

/** A whole number as typed; `NaN` when it isn't one. */
export function parseCount(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN;
}

/** Messages per copy field (top-level fields, and `details.<field>`). */
export const COPY_FIELD_MESSAGES: Readonly<Record<string, string>> = {
  ownership: 'Choose a status.',
  quantity: 'Enter a whole number from 1 to 9999.',
  acquiredAt: 'Enter a valid date.',
  purchasePrice: 'Enter an amount of 0 or more, with at most two decimals.',
  estimatedValue: 'Enter an amount of 0 or more, with at most two decimals.',
  currency: 'Choose a currency.',
  notes: 'Notes can be at most 5000 characters.',
  format: 'The medium can be at most 100 characters.',
  'details.discCount': 'Enter a number of discs from 1 to 99.',
  'details.seasons': 'Pick at least one episode for each ticked season.',
};

/** Field errors of a failed zod parse, keyed like `COPY_FIELD_MESSAGES`. */
export function copyFieldErrors(
  issues: readonly { path: readonly PropertyKey[] }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const [head, field] = issue.path.map(String);
    const key = head === 'details' && field ? `details.${field}` : (head ?? 'form');
    errors[key] ??= copyFieldMessage(key);
  }
  return errors;
}

/** The message of a copy field key (`quantity`, `details.discCount`, ...). */
export function copyFieldMessage(key: string): string {
  return COPY_FIELD_MESSAGES[key] ?? 'Check this value.';
}
