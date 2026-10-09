import { GatewayError } from '../errors';
import { errorResponse } from './responses';

import type { UserLimiter } from '../rate-limit/user-limiter';
import type { NextRequest } from 'next/server';

export interface GatewayRouteDeps {
  /** The signed-in user's ID, or `null` when the request has no valid session or token. */
  authenticate: (request: NextRequest) => Promise<string | null>;
  userLimiter: UserLimiter;
}

export type GatewayHandler<C> = (
  request: NextRequest,
  ctx: { userId: string; context: C },
) => Promise<Response>;

/**
 * Builds the wrapper every gateway Route Handler goes through: authentication (401), the per-user
 * rate limit (429), then the handler, with every error turned into the gateway's error shape.
 */
export function createGatewayRoute({ authenticate, userLimiter }: GatewayRouteDeps) {
  return function gatewayRoute<C>(name: string, handler: GatewayHandler<C>) {
    return async (request: NextRequest, context: C): Promise<Response> => {
      try {
        const userId = await authenticate(request);
        if (!userId) throw new GatewayError('unauthorized', 'Sign in to use the API.');

        const limit = userLimiter.check(userId);
        if (!limit.allowed) {
          throw new GatewayError('rate_limited', 'Too many requests. Try again shortly.', {
            retryAfterSeconds: limit.retryAfterSeconds,
          });
        }
        return await handler(request, { userId, context });
      } catch (error) {
        return errorResponse(error, name);
      }
    };
  };
}
