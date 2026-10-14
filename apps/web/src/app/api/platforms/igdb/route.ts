import { platformListResponseSchema } from '@fanste/core';

import { GatewayError } from '@/server/errors';
import { gatewayRoute, igdbPlatforms } from '@/server/gateway';
import { jsonOk } from '@/server/http/responses';
import { CACHE_CONTROL } from '@/server/limits';

/**
 * `GET /api/platforms/igdb`: every IGDB platform, for the platform field of a game copy (FC-11).
 * Cached per instance (`IGDB_LIMITS.platformsTtlMs`) and in the browser.
 */
export const GET = gatewayRoute('platforms.igdb', async () => {
  if (!igdbPlatforms) {
    throw new GatewayError('provider_not_configured', 'igdb is not set up yet.', {
      provider: 'igdb',
    });
  }
  const platforms = await igdbPlatforms.platforms();
  return jsonOk(platformListResponseSchema, { platforms }, CACHE_CONTROL.platforms);
});
