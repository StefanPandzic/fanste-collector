import type { z } from 'zod';

/**
 * Parses an object field by field and keeps only the valid fields, so stored jsonb from an older
 * schema version (or written by hand) loses a bad field instead of all of them.
 */
export function parseFields<Shape extends z.ZodRawShape>(
  shape: Shape,
  value: unknown,
): Partial<z.output<z.ZodObject<Shape>>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const parsed: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(shape)) {
    if (record[key] === undefined) continue;
    const result = (schema as z.ZodType).safeParse(record[key]);
    if (result.success && result.data !== undefined) parsed[key] = result.data;
  }
  return parsed as Partial<z.output<z.ZodObject<Shape>>>;
}

/** Size of `value` as UTF-8 JSON, for the jsonb size limits. */
export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value) ?? '').length;
}
