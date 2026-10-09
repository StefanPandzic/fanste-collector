import { GatewayError } from '../errors';
import { CACHE_CONTROL } from '../limits';
import { gatewayLog } from '../log';

import type { ApiError } from '@fanste/core';
import type { z } from 'zod';

// Responses depend on the caller's session, so caches must key them on it.
const VARY = 'Authorization, Cookie';

/** A JSON response, validated against the endpoint's schema so clients get what the contract says. */
export function jsonOk<S extends z.ZodType>(
  schema: S,
  data: z.input<S>,
  cacheControl: string = CACHE_CONTROL.noStore,
): Response {
  return Response.json(schema.parse(data), {
    headers: { 'Cache-Control': cacheControl, Vary: VARY },
  });
}

/**
 * The `{ error: { code, message, provider? } }` response for any thrown value. Only a
 * `GatewayError`'s message reaches the client; anything else is logged and answered with `internal`.
 */
export function errorResponse(error: unknown, route: string): Response {
  const gatewayError =
    error instanceof GatewayError ? error : new GatewayError('internal', 'Something went wrong.');
  if (gatewayError.code === 'internal') gatewayLog.error('route.failed', { route }, error);

  const body: ApiError = {
    error: {
      code: gatewayError.code,
      message: gatewayError.message,
      ...(gatewayError.provider ? { provider: gatewayError.provider } : {}),
    },
  };
  const headers: Record<string, string> = { 'Cache-Control': CACHE_CONTROL.noStore, Vary: VARY };
  if (gatewayError.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(gatewayError.retryAfterSeconds);
  }
  return Response.json(body, { status: gatewayError.status, headers });
}

/** Parses request input; a mismatch becomes a `bad_request` naming the first problem. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = issue?.path.join('.');
  const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request.';
  throw new GatewayError('bad_request', message);
}

/** The request body as JSON; malformed JSON is a `bad_request`. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new GatewayError('bad_request', 'The request body must be JSON.');
  }
}
