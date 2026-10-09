import { normalizedItemSchema, normalizedItemShape } from './normalized-item';

import type { ItemCategory, MetadataProvider } from './enums';
import type { NormalizedItem } from './normalized-item';

/** A JSON value, as Postgres `jsonb` stores it. Same as the `Json` type of `@fanste/supabase`. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * A `metadata_cache` row (FC-05), snake_case like the table. Core declares it itself so it doesn't
 * depend on `@fanste/supabase`; `db-compat.test.ts` keeps the two in sync.
 */
export interface MetadataCacheRow {
  provider: MetadataProvider;
  external_id: string;
  category: ItemCategory;
  title: string;
  subtitle: string | null;
  release_year: number | null;
  image_url: string | null;
  /** The `NormalizedItem` fields without a column of their own (see `PAYLOAD_FIELDS`). */
  payload: Json | null;
  /** Set by the database on insert. */
  fetched_at?: string;
}

/** Fields stored in `payload`. Keep them small: the free tier has 500 MB (FC-05). */
const PAYLOAD_FIELDS = [
  'thumbnailUrl',
  'description',
  'genres',
  'creators',
  'extra',
  'sourceUrl',
] as const satisfies readonly (keyof NormalizedItem)[];

/** Optional fields with a column of their own. */
const COLUMN_FIELDS = ['subtitle', 'releaseYear', 'imageUrl'] as const;

type OptionalField = (typeof COLUMN_FIELDS)[number] | (typeof PAYLOAD_FIELDS)[number];

/**
 * Converts an item into a cache row for an upsert. The cache is shared by all users, so the item is
 * validated first and an invalid one throws instead of being cached. Custom items are never cached.
 */
export function toMetadataCacheRow(input: NormalizedItem): MetadataCacheRow {
  const item = normalizedItemSchema.parse(input);
  if (item.provider === 'custom') {
    throw new Error('Custom items are not stored in the metadata cache.');
  }

  const payload: Record<string, unknown> = {};
  for (const field of PAYLOAD_FIELDS) {
    if (item[field] !== undefined) payload[field] = item[field];
  }

  return {
    provider: item.provider,
    external_id: item.externalId,
    category: item.category,
    title: item.title,
    subtitle: item.subtitle ?? null,
    release_year: item.releaseYear ?? null,
    image_url: item.imageUrl ?? null,
    // The round trip guarantees a plain JSON value (`extra` is an open record).
    payload: Object.keys(payload).length > 0 ? (JSON.parse(JSON.stringify(payload)) as Json) : null,
  };
}

/**
 * Converts a cache row back into an item. The identity columns are checked by the database; the
 * optional columns and the `payload` fields are validated one by one, and a value that doesn't match
 * is dropped instead of failing the read.
 */
export function fromMetadataCacheRow(row: MetadataCacheRow): NormalizedItem {
  const item: NormalizedItem = {
    provider: row.provider,
    externalId: row.external_id,
    category: row.category,
    title: row.title,
  };

  const payload = isRecord(row.payload) ? row.payload : {};
  const values: Partial<Record<OptionalField, unknown>> = {
    ...payload,
    subtitle: row.subtitle ?? undefined,
    releaseYear: row.release_year ?? undefined,
    imageUrl: row.image_url ?? undefined,
  };
  for (const field of [...COLUMN_FIELDS, ...PAYLOAD_FIELDS]) {
    const result = normalizedItemShape.shape[field].safeParse(values[field]);
    if (result.success && result.data !== undefined) {
      Object.assign(item, { [field]: result.data });
    }
  }
  return item;
}

function isRecord(value: Json | null): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
