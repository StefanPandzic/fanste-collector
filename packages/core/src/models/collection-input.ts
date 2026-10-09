import { z } from 'zod';

import { ITEM_SOURCES } from './collection-item';
import { detailsSchemaFor, movieDetailsShape, tvDetailsShape } from './copy-details';
import { itemCategorySchema, metadataProviderSchema, ownershipStatusSchema } from './enums';
import { metadataOverridesShape } from './metadata-overrides';
import { checkProviderIdentity } from './normalized-item';

import type { ItemCategory } from './enums';

// What clients send to the collection repository (FC-14). The database checks the same rules; these
// schemas catch them before a round trip and give readable messages.

/** Largest value `numeric(12, 2)` holds. */
export const MAX_MONEY = 9_999_999_999.99;
export const MAX_QUANTITY = 9999;
export const MAX_FORMAT_LENGTH = 100;
export const MAX_NOTES_LENGTH = 5000;
/** Same limit as the `tags.name` check constraint. */
export const MAX_TAG_NAME_LENGTH = 50;

/** Trimmed text where an empty string means "no value". */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();
}

const money = z.number().min(0).max(MAX_MONEY).nullable();

/** The user's data about one copy: everything on a `collection_items` row except its identity. */
const copyFields = z.object({
  /** Medium, e.g. `4K UHD Blu-ray` (see `FORMATS_BY_CATEGORY`). */
  format: optionalText(MAX_FORMAT_LENGTH),
  ownership: ownershipStatusSchema,
  quantity: z.int().min(1).max(MAX_QUANTITY),
  /** `YYYY-MM-DD`. */
  acquiredAt: z.iso.date().nullable(),
  purchasePrice: money,
  /** Value of one unit; the stats multiply it by `quantity`. */
  estimatedValue: money,
  /** ISO 4217 code. */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  notes: optionalText(MAX_NOTES_LENGTH),
});

/**
 * A new copy of a provider item. Custom items (`provider: 'custom'`) get their own input in FC-13.
 * `details` is checked against the category's schema (`detailsSchemaFor`); suggest its values with
 * `prefillDetails`.
 */
export const addItemInputSchema = copyFields
  .partial()
  .extend({
    category: itemCategorySchema,
    provider: metadataProviderSchema.exclude(['custom']),
    externalId: z.string().trim().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
    source: z.enum(ITEM_SOURCES).optional(),
  })
  .superRefine(checkProviderIdentity)
  .transform((input, ctx) => {
    if (input.details === undefined) return input;
    const result = detailsSchemaFor(input.category).safeParse(input.details);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['details', ...issue.path] });
      }
      return z.NEVER;
    }
    return { ...input, details: result.data };
  });

export type AddItemInput = z.input<typeof addItemInputSchema>;

/**
 * Changes to a copy. Copy details and metadata overrides are edited with their own functions, which
 * merge instead of replacing (`detailsPatchSchemaFor`, `overridesPatchSchema`).
 */
export const updateItemPatchSchema = copyFields.partial();

export type UpdateItemPatch = z.input<typeof updateItemPatchSchema>;

/** Makes every field of a shape optional and nullable: `null` removes the field. */
function patchShape<Shape extends z.ZodRawShape>(shape: Shape) {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [
      key,
      (schema as z.ZodType).nullable().optional(),
    ]),
  ) as unknown as { [K in keyof Shape]: z.ZodOptional<z.ZodNullable<Shape[K]>> };
}

const loosePatchSchema = z.record(z.string(), z.unknown());

const DETAILS_PATCH_SCHEMAS = {
  movie: z.object(patchShape(movieDetailsShape)),
  tv: z.object(patchShape(tvDetailsShape)),
  music: loosePatchSchema,
  video_game: loosePatchSchema,
  board_game: loosePatchSchema,
  funko: loosePatchSchema,
} satisfies Record<ItemCategory, z.ZodType>;

/**
 * Changes to a copy's `details`: present fields are set, `null` fields removed, others kept. Arrays
 * (languages, `seasons`) are replaced as a whole. Keys the schema doesn't know are stripped, so a key
 * from an older schema version can't be removed this way; `parseDetails` ignores it on read.
 */
export function detailsPatchSchemaFor<C extends ItemCategory>(
  category: C,
): (typeof DETAILS_PATCH_SCHEMAS)[C] {
  return DETAILS_PATCH_SCHEMAS[category];
}

export type DetailsPatch<C extends ItemCategory = ItemCategory> = z.input<
  (typeof DETAILS_PATCH_SCHEMAS)[C]
>;

/** Changes to the metadata overrides: present fields are set, `null` resets a field to the API value. */
export const overridesPatchSchema = z.object(patchShape(metadataOverridesShape));

export type OverridesPatch = z.input<typeof overridesPatchSchema>;

/** A user's tag. `color` is a hex color like `#3b82f6`. */
export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(MAX_TAG_NAME_LENGTH),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export type TagInput = z.input<typeof tagInputSchema>;

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export const COLLECTION_SORTS = [
  'added_desc',
  'added_asc',
  'title_asc',
  'title_desc',
  'year_desc',
  'year_asc',
] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

export const DEFAULT_COLLECTION_PAGE_SIZE = 60;
export const MAX_COLLECTION_PAGE_SIZE = 200;

/** A page of the user's collection. Filters combine with AND; `tagIds` matches items with any of them. */
export const collectionQuerySchema = z.object({
  category: itemCategorySchema.optional(),
  ownership: z.array(ownershipStatusSchema).optional(),
  tagIds: z.array(z.uuid()).optional(),
  /** Matched against the displayed title (overrides applied). */
  search: z.string().trim().max(200).optional(),
  sort: z.enum(COLLECTION_SORTS).default('added_desc'),
  /** Starts at 1. */
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(MAX_COLLECTION_PAGE_SIZE).default(DEFAULT_COLLECTION_PAGE_SIZE),
});

export type CollectionQuery = z.input<typeof collectionQuerySchema>;
