import { z } from 'zod';

import { itemCategorySchema, metadataProviderSchema, ownershipStatusSchema } from './enums';
import { normalizedItemSchema } from './normalized-item';

/**
 * How an item got into the collection. Mirrors the `collection_items.source` check constraint (FC-05),
 * which `db-compat.test.ts` can't see: keep the two in sync by hand.
 */
export const ITEM_SOURCES = ['manual', 'search', 'scanner'] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

const timestamp = z.iso.datetime({ offset: true });
const money = z.number().min(0);

/**
 * A copy in the user's collection as the UI uses it: the `collection_items` row (camelCase) plus the
 * item's metadata. The repository layer (FC-14) builds it from `collection_items_view`.
 */
export const collectionItemSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  category: itemCategorySchema,
  provider: metadataProviderSchema,
  /** `null` for custom items. */
  externalId: z.string().nullable(),
  /** Medium, e.g. `4K UHD Blu-ray` (see `FORMATS_BY_CATEGORY`). Free text, so "Other" fits too. */
  format: z.string().nullable(),
  // The user's copy (resolution, edition, discs, ...) and their corrections of provider fields. Typed
  // per category by FC-15; until then they are loose records.
  details: z.record(z.string(), z.unknown()),
  metadataOverrides: z.record(z.string(), z.unknown()),
  ownership: ownershipStatusSchema,
  quantity: z.int().min(1),
  /** `YYYY-MM-DD`. */
  acquiredAt: z.iso.date().nullable(),
  purchasePrice: money.nullable(),
  estimatedValue: money.nullable(),
  /** ISO 4217 code. */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  notes: z.string().nullable(),
  source: z.enum(ITEM_SOURCES),
  createdAt: timestamp,
  updatedAt: timestamp,
  /** IDs of the user's tags on this copy (`collection_item_tags`). */
  tagIds: z.array(z.uuid()),
  /**
   * Provider metadata (or the custom item's own data, FC-13), without the user's overrides. `null`
   * while it isn't cached yet: fetch it through the gateway's batch endpoint (FC-14).
   */
  metadata: normalizedItemSchema.nullable(),
});

export type CollectionItem = z.output<typeof collectionItemSchema>;
