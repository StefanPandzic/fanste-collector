import { MAX_SEARCH_PAGE } from '@fanste/core';

import { GatewayError } from '../../errors';
import { IGDB_LIMITS } from '../../limits';
import { gatewayLog } from '../../log';
import { providerFetch } from '../provider-fetch';
import { exactTitlesFirst, mapGame, mapPlatform, mapSearchResult } from './mappers';
import {
  IGDB_PAGE_SIZE,
  IGDB_PLATFORM_QUERY,
  igdbGameQuery,
  igdbSearchQuery,
  searchText,
} from './queries';
import { igdbGamesSchema, igdbPlatformsSchema } from './schemas';
import { createTwitchTokenSource } from './token';

import type { ProviderAdapter } from '../types';
import type { TwitchTokenSource } from './token';
import type { GamePlatform, ItemCategory, NormalizedItem, SearchResponse } from '@fanste/core';
import type { z } from 'zod';

const API_URL = 'https://api.igdb.com/v4';

export interface IgdbAdapterOptions {
  /** The Twitch app's Client ID and Secret (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`). */
  clientId: string;
  clientSecret: string;
  /** The current time; replaced in tests. */
  now?: () => number;
}

export interface IgdbPlatforms {
  /** Every IGDB platform, sorted by name; cached per instance for `IGDB_LIMITS.platformsTtlMs`. */
  platforms(): Promise<GamePlatform[]>;
}

export type IgdbAdapter = ProviderAdapter & IgdbPlatforms;

function checkCategory(category: ItemCategory) {
  if (category !== 'video_game') {
    throw new GatewayError('unsupported_category', `IGDB has no "${category}" items.`, {
      provider: 'igdb',
    });
  }
}

/**
 * The IGDB adapter (FC-11): video games, through Twitch's client-credentials token. Every query is
 * a POST with an Apicalypse body (`queries.ts`); a `401` renews the token and retries once, so an
 * expired token never fails a user's request.
 */
export function createIgdbAdapter({
  clientId,
  clientSecret,
  now = Date.now,
}: IgdbAdapterOptions): IgdbAdapter {
  const tokens: TwitchTokenSource = createTwitchTokenSource({ clientId, clientSecret, now });
  let platformList: { value: Promise<GamePlatform[]>; expiresAt: number } | undefined;

  async function send(endpoint: string, body: string): Promise<Response> {
    const token = await tokens.get();
    return providerFetch(
      'igdb',
      `${API_URL}/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'text/plain',
        },
        body,
      },
      { returnStatuses: [401] },
    ).then((response) => {
      if (response.status === 401) tokens.invalidate(token);
      return response;
    });
  }

  async function query<S extends z.ZodType>(
    endpoint: string,
    body: string,
    schema: S,
  ): Promise<{ data: z.output<S>; count: number }> {
    let response = await send(endpoint, body);
    if (response.status === 401) {
      await response.body?.cancel();
      response = await send(endpoint, body);
    }
    if (response.status === 401) {
      await response.body?.cancel();
      throw new GatewayError('provider_error', 'igdb rejected the app credentials.', {
        provider: 'igdb',
      });
    }
    const result = schema.safeParse(await response.json().catch(() => undefined));
    if (!result.success) {
      gatewayLog.error('igdb.unexpected_response', { endpoint }, result.error);
      throw new GatewayError('provider_error', 'igdb sent an unexpected response.', {
        provider: 'igdb',
      });
    }
    const count = Number(response.headers.get('x-count'));
    return { data: result.data, count: Number.isInteger(count) && count >= 0 ? count : 0 };
  }

  return {
    provider: 'igdb',
    categories: ['video_game'],

    async search(q, { category, page, year, platform }): Promise<SearchResponse> {
      checkCategory(category);
      if (!searchText(q)) {
        throw new GatewayError('bad_request', 'Enter something to search for.');
      }
      const { data, count } = await query(
        'games',
        igdbSearchQuery(q, {
          page,
          ...(year === undefined ? {} : { year }),
          // A validated integer (`searchQuerySchema`), so it can go into the query as it is.
          ...(platform === undefined ? {} : { platform }),
        }),
        igdbGamesSchema,
      );
      return {
        results: exactTitlesFirst(
          data.flatMap((game) => mapSearchResult(game) ?? []),
          q,
        ),
        page,
        totalPages: Math.min(Math.ceil(count / IGDB_PAGE_SIZE), MAX_SEARCH_PAGE),
        totalResults: count,
      };
    },

    async getById(externalId, category): Promise<NormalizedItem> {
      checkCategory(category);
      if (!/^\d+$/.test(externalId)) {
        throw new GatewayError('bad_request', 'Invalid external ID for this provider.');
      }
      const { data } = await query('games', igdbGameQuery(externalId), igdbGamesSchema);
      const [game] = data;
      if (!game)
        throw new GatewayError('not_found', 'igdb has no such item.', { provider: 'igdb' });
      const item = mapGame(game);
      if (!item) {
        throw new GatewayError('provider_error', 'igdb sent a game without a name.', {
          provider: 'igdb',
        });
      }
      return item;
    },

    platforms() {
      if (platformList && now() < platformList.expiresAt) return platformList.value;
      const value = query('platforms', IGDB_PLATFORM_QUERY, igdbPlatformsSchema).then(({ data }) =>
        data.flatMap((platform) => mapPlatform(platform) ?? []),
      );
      platformList = { value, expiresAt: now() + IGDB_LIMITS.platformsTtlMs };
      // A failure isn't cached: the next call asks again.
      value.catch(() => {
        if (platformList?.value === value) platformList = undefined;
      });
      return value;
    },
  };
}
