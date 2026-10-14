import { GatewayError } from '../../errors';
import { IGDB_LIMITS } from '../../limits';
import { gatewayLog } from '../../log';
import { providerFetch } from '../provider-fetch';
import { twitchTokenSchema } from './schemas';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

export interface TwitchTokenOptions {
  clientId: string;
  clientSecret: string;
  /** The current time; replaced in tests. */
  now?: () => number;
}

/** The app access token IGDB requests carry (`Authorization: Bearer`). */
export interface TwitchTokenSource {
  /** A valid token: the cached one, or a new one when it's missing or about to expire. */
  get(): Promise<string>;
  /**
   * Drops `token` after IGDB rejected it (`401`), so the next `get()` asks for a new one. A token
   * that was already replaced is ignored, so concurrent failures renew it once.
   */
  invalidate(token: string): void;
}

/**
 * Twitch's client-credentials flow (FC-11). The token is cached per server instance until
 * `IGDB_LIMITS.tokenRefreshMarginMs` before it expires; requests that need a new one at the same
 * time share one Twitch call. The secret goes in the POST body, never in a logged URL.
 */
export function createTwitchTokenSource({
  clientId,
  clientSecret,
  now = Date.now,
}: TwitchTokenOptions): TwitchTokenSource {
  let cached: { token: string; renewAt: number } | undefined;
  let pending: Promise<string> | undefined;

  async function request(): Promise<string> {
    const response = await providerFetch('igdb', TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    const result = twitchTokenSchema.safeParse(await response.json().catch(() => undefined));
    if (!result.success) {
      gatewayLog.error('igdb.unexpected_token_response', {}, result.error);
      throw new GatewayError('provider_error', 'igdb sent an unexpected response.', {
        provider: 'igdb',
      });
    }
    const lifetimeMs = result.data.expires_in * 1000;
    // A token shorter-lived than the margin is still used for half its life.
    const margin = Math.min(IGDB_LIMITS.tokenRefreshMarginMs, lifetimeMs / 2);
    cached = { token: result.data.access_token, renewAt: now() + lifetimeMs - margin };
    return result.data.access_token;
  }

  return {
    get() {
      if (cached && now() < cached.renewAt) return Promise.resolve(cached.token);
      pending ??= request().finally(() => {
        pending = undefined;
      });
      return pending;
    },

    invalidate(token) {
      if (cached?.token === token) cached = undefined;
    },
  };
}
