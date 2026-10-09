import { z } from 'zod';

import { metadataProviderSchema } from '../models/enums';

/** Machine-readable error codes of the API gateway (FC-08). Clients branch on these, not on text. */
export const API_ERROR_CODES = [
  /** No valid session cookie or bearer token (401). */
  'unauthorized',
  /** The caller sent too many requests (429); retry after the `Retry-After` header. */
  'rate_limited',
  /** The query or body failed validation (400). */
  'bad_request',
  /** The provider has no item with that ID (404). */
  'not_found',
  /** The category has no metadata provider, e.g. Funko Pops (400). */
  'unsupported_category',
  /** The provider failed or kept rate-limiting us after retries (502). */
  'provider_error',
  /** The provider exists but its adapter isn't set up yet (501). */
  'provider_not_configured',
  /** The endpoint exists but isn't implemented yet (501). */
  'not_implemented',
  /** Anything else (500). */
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

/** The body of every gateway error response. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    provider: metadataProviderSchema.optional(),
  }),
});

export type ApiError = z.output<typeof apiErrorSchema>;
