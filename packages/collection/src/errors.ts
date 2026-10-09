import { z } from 'zod';

import { ApiClientError } from '@fanste/api-client';

export const COLLECTION_ERROR_CODES = [
  /** The user already has this item in this format (unique copy), or a tag with this name. */
  'duplicate',
  /** The row doesn't exist, or belongs to someone else (RLS hides it). */
  'not_found',
  /** The input failed validation, here or in a database check. */
  'invalid',
  /** RLS or a missing grant rejected the request, e.g. after the session expired. */
  'forbidden',
  /** The metadata provider is busy or failed; try again later. */
  'provider_unavailable',
  /** No connection to Supabase or the gateway. */
  'network',
  'unknown',
] as const;
export type CollectionErrorCode = (typeof COLLECTION_ERROR_CODES)[number];

/** An error from the collection data layer. Show `collectionErrorMessage()`, never `cause`. */
export class CollectionError extends Error {
  readonly code: CollectionErrorCode;

  constructor(code: CollectionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CollectionError';
    this.code = code;
  }
}

const MESSAGES: Record<CollectionErrorCode, string> = {
  duplicate: 'That is already in your collection.',
  not_found: 'That item no longer exists.',
  invalid: 'Some of the values are not valid.',
  forbidden: 'You are not allowed to do that. Try signing in again.',
  provider_unavailable: 'The metadata provider is busy. Try again in a moment.',
  network: 'You seem to be offline. Check your connection and try again.',
  unknown: 'Something went wrong. Try again.',
};

/** A message for the user. Raw database or provider text is never shown. */
export function collectionErrorMessage(error: unknown): string {
  return MESSAGES[toCollectionError(error).code];
}

// Postgres error codes (via PostgREST) and PostgREST's own codes.
const POSTGRES_CODES: Record<string, CollectionErrorCode> = {
  '23505': 'duplicate', // unique_violation
  '23503': 'not_found', // foreign_key_violation: the item or tag of a link is gone
  '23514': 'invalid', // check_violation
  '23502': 'invalid', // not_null_violation
  '22P02': 'invalid', // invalid_text_representation (bad uuid, enum, ...)
  '22003': 'invalid', // numeric_value_out_of_range
  '42501': 'forbidden', // insufficient_privilege / RLS
  PGRST116: 'not_found', // `.single()` matched no row
  PGRST301: 'forbidden', // JWT expired or invalid
};

const API_CODES: Partial<Record<ApiClientError['code'], CollectionErrorCode>> = {
  not_found: 'not_found',
  bad_request: 'invalid',
  unauthorized: 'forbidden',
  rate_limited: 'provider_unavailable',
  provider_error: 'provider_unavailable',
  provider_not_configured: 'provider_unavailable',
};

const postgrestErrorSchema = z.object({ code: z.string(), message: z.string() });

/** Converts anything thrown by Supabase, the gateway client or zod into a `CollectionError`. */
export function toCollectionError(error: unknown): CollectionError {
  if (error instanceof CollectionError) return error;
  if (error instanceof z.ZodError) {
    return new CollectionError('invalid', 'Invalid input.', { cause: error });
  }
  if (error instanceof ApiClientError) {
    return new CollectionError(API_CODES[error.code] ?? 'unknown', error.message, { cause: error });
  }
  // `fetch` rejects with a TypeError ("Failed to fetch", "fetch failed", "NetworkError …") when there
  // is no connection. Other TypeErrors are bugs, not connection problems.
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new CollectionError('network', error.message, { cause: error });
  }
  const postgrest = postgrestErrorSchema.safeParse(error);
  if (postgrest.success) {
    const { code, message } = postgrest.data;
    // supabase-js reports a failed `fetch` as an error object with an empty code.
    const fallback = /fetch/i.test(message) ? 'network' : 'unknown';
    return new CollectionError(POSTGRES_CODES[code] ?? fallback, message, { cause: error });
  }
  return new CollectionError('unknown', error instanceof Error ? error.message : String(error), {
    cause: error,
  });
}
