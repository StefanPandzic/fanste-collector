import { z } from 'zod';

import { jsonByteLength, parseFields } from './lenient';
import { MAX_RELEASE_YEAR, MIN_RELEASE_YEAR } from './normalized-item';

import type { NormalizedItem } from './normalized-item';

// The user's corrections of provider metadata (FC-15), stored in `collection_items.metadata_overrides`.
// The displayed item is always `{ ...providerMetadata, ...overrides }`; a metadata refresh never
// touches the overrides.

export const MAX_OVERRIDE_TITLE_LENGTH = 500;
export const MAX_OVERRIDE_DESCRIPTION_LENGTH = 10_000;
/**
 * Largest `metadata_overrides` object as JSON. The database allows twice as much (see
 * `MAX_DETAILS_BYTES`).
 */
export const MAX_OVERRIDES_BYTES = 16 * 1024;

const title = z.string().trim().min(1).max(MAX_OVERRIDE_TITLE_LENGTH);
const names = z
  .array(z.string().trim().min(1).max(200))
  .max(50)
  .transform((list) => [...new Set(list)]);

/** The overridable fields of `NormalizedItem`. */
export const metadataOverridesShape = {
  title: title.optional(),
  subtitle: title.optional(),
  releaseYear: z.int().min(MIN_RELEASE_YEAR).max(MAX_RELEASE_YEAR).optional(),
  /**
   * Custom cover, https only (no mixed content). Provider covers load through `next/image`, whose
   * allowed hosts are the providers' (`next.config.ts`); FC-19 renders user URLs without the optimizer.
   */
  imageUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .optional(),
  description: z.string().trim().min(1).max(MAX_OVERRIDE_DESCRIPTION_LENGTH).optional(),
  genres: names.optional(),
  creators: names.optional(),
};

export const metadataOverridesSchema = z
  .object(metadataOverridesShape)
  .refine(
    (value) => jsonByteLength(value) <= MAX_OVERRIDES_BYTES,
    `Overrides can be at most ${MAX_OVERRIDES_BYTES / 1024} KB.`,
  );

export type MetadataOverrides = z.output<typeof metadataOverridesSchema>;
export type OverridableField = keyof MetadataOverrides;

export const OVERRIDABLE_FIELDS = Object.keys(metadataOverridesShape) as OverridableField[];

/** Reads stored overrides: keeps the valid fields and drops the rest, so it never throws. */
export function parseOverrides(value: unknown): MetadataOverrides {
  return parseFields(metadataOverridesShape, value);
}

export interface DisplayItem {
  /** The provider metadata with the user's overrides applied. */
  item: NormalizedItem;
  /** Fields whose value comes from an override (for the "edited" marker). */
  overridden: OverridableField[];
}

/** The item as shown: provider metadata with the overrides on top. */
export function applyOverrides(item: NormalizedItem, overrides: MetadataOverrides): DisplayItem {
  const display: NormalizedItem = { ...item };
  const overridden: OverridableField[] = [];
  for (const field of OVERRIDABLE_FIELDS) {
    const value = overrides[field];
    if (value === undefined) continue;
    // Each override has the type of the `NormalizedItem` field it replaces.
    (display as Record<string, unknown>)[field] = value;
    overridden.push(field);
  }
  // A custom cover replaces the provider's thumbnail too, or the gallery would show the old one.
  if (overrides.imageUrl !== undefined) display.thumbnailUrl = overrides.imageUrl;
  return { item: display, overridden };
}
