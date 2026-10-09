import { z } from 'zod';

/** Tables whose changes the FC-05 triggers broadcast to `user:<id>`. */
export const BROADCAST_TABLES = ['collection_items', 'collection_item_tags'] as const;
export type BroadcastTable = (typeof BROADCAST_TABLES)[number];

export type ChangeOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/** One row change, reduced to what the query cache needs. */
export interface CollectionChange {
  table: BroadcastTable;
  operation: ChangeOperation;
  /** The collection item that changed (for tag links, the linked item). */
  itemId: string;
}

const rowSchema = z.object({ id: z.string().optional(), item_id: z.string().optional() }).nullish();

// The payload of `realtime.broadcast_changes()`: the table, the operation and the new/old rows.
const payloadSchema = z.object({
  table: z.enum(BROADCAST_TABLES),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  record: rowSchema,
  old_record: rowSchema,
});

/** Reads a Broadcast payload; returns `undefined` for anything that isn't a known change. */
export function parseCollectionChange(payload: unknown): CollectionChange | undefined {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  const { table, operation, record, old_record: oldRecord } = parsed.data;
  const row = record ?? oldRecord;
  const itemId = table === 'collection_items' ? row?.id : row?.item_id;
  return itemId ? { table, operation, itemId } : undefined;
}
