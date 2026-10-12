import { MAX_SEARCH_PAGE } from '@fanste/core';

import { GatewayError } from '../../errors';
import { DISCOGS_RATE } from '../../limits';
import { gatewayLog } from '../../log';
import { providerFetch } from '../provider-fetch';
import { mapMaster, mapRelease, mapSearchResult } from './mappers';
import { discogsMasterSchema, discogsReleaseSchema, discogsSearchSchema } from './schemas';

import type { ProviderAdapter } from '../types';
import type { DiscogsKind } from './mappers';
import type { ItemCategory, NormalizedItem, SearchResponse } from '@fanste/core';
import type { z } from 'zod';

const API_URL = 'https://api.discogs.com';

/** The contact URL of the `User-Agent` when `DISCOGS_USER_AGENT_URL` isn't set. */
export const DISCOGS_DEFAULT_CONTACT_URL = 'https://github.com/StefanPandzic/fanste-collector';

/** Results per search page, like TMDB's 20. */
export const DISCOGS_PAGE_SIZE = 20;

export interface DiscogsAdapterOptions {
  /** The app's Consumer Key and Secret, sent in the `Authorization` header. */
  consumerKey: string;
  consumerSecret: string;
  /** The contact URL of the `User-Agent` Discogs requires. */
  contactUrl?: string;
}

/** The `User-Agent` Discogs requires: the app's name, version and a contact URL. */
export function discogsUserAgent(contactUrl = DISCOGS_DEFAULT_CONTACT_URL): string {
  return `FansteCollector/1.0 +${contactUrl}`;
}

/**
 * How long to pause the Discogs throttle after `response`: on a 429, and when
 * `X-Discogs-Ratelimit-Remaining` is down to `DISCOGS_RATE.reserve`, one request interval of the
 * minute's limit per request below the reserve (see `DISCOGS_RATE`).
 */
export function discogsPauseMs(response: Response): number | undefined {
  if (response.status === 429) return DISCOGS_RATE.pauseOn429Ms;
  const limitHeader = response.headers.get('x-discogs-ratelimit');
  const remainingHeader = response.headers.get('x-discogs-ratelimit-remaining');
  if (limitHeader === null || remainingHeader === null) return undefined;
  const limit = Number(limitHeader);
  const remaining = Number(remainingHeader);
  if (!Number.isInteger(limit) || limit <= 0 || !Number.isInteger(remaining)) return undefined;
  if (remaining > DISCOGS_RATE.reserve) return undefined;
  return Math.ceil(60_000 / limit) * (DISCOGS_RATE.reserve + 1 - Math.max(0, remaining));
}

/**
 * The search parameter of a barcode or catalog number: digits only (spaces and dashes ignored, at
 * least 8, like EAN-8 / UPC / EAN-13) is a `barcode`, anything else a `catno`.
 */
export function codeParam(code: string): { barcode: string } | { catno: string } {
  const digits = code.replace(/[\s-]/g, '');
  return /^\d{8,14}$/.test(digits) ? { barcode: digits } : { catno: code.trim() };
}

function checkCategory(category: ItemCategory) {
  if (category !== 'music') {
    throw new GatewayError('unsupported_category', `Discogs has no "${category}" items.`, {
      provider: 'discogs',
    });
  }
}

/** The kind and numeric ID of `release:249504` / `master:33013`. */
function parseExternalId(externalId: string): { kind: DiscogsKind; id: string } {
  const match = /^(release|master):(\d+)$/.exec(externalId);
  if (!match?.[1] || !match[2]) {
    throw new GatewayError('bad_request', 'Invalid external ID for this provider.');
  }
  return { kind: match[1] as DiscogsKind, id: match[2] };
}

/**
 * The Discogs adapter (FC-10): music releases from the Discogs database, with the app's own key and
 * secret. Searches return releases (pressings); `getById` also loads masters. A user's own Discogs
 * collection needs their OAuth tokens (FC-31).
 */
export function createDiscogsAdapter({
  consumerKey,
  consumerSecret,
  contactUrl,
}: DiscogsAdapterOptions): ProviderAdapter {
  const headers = {
    Authorization: `Discogs key=${consumerKey}, secret=${consumerSecret}`,
    'User-Agent': discogsUserAgent(contactUrl),
    Accept: 'application/vnd.discogs.v2.discogs+json',
  };

  async function get<S extends z.ZodType>(
    path: string,
    schema: S,
    params: Record<string, string | number | undefined> = {},
  ): Promise<z.output<S>> {
    const url = new URL(`${API_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await providerFetch(
      'discogs',
      url,
      { headers },
      { pauseAfter: discogsPauseMs },
    );
    const result = schema.safeParse(await response.json().catch(() => undefined));
    if (!result.success) {
      gatewayLog.error('discogs.unexpected_response', { path }, result.error);
      throw new GatewayError('provider_error', 'discogs sent an unexpected response.', {
        provider: 'discogs',
      });
    }
    return result.data;
  }

  return {
    provider: 'discogs',
    categories: ['music'],

    async search(q, { category, page, year, format, country, code }): Promise<SearchResponse> {
      checkCategory(category);
      const lookup = code ? codeParam(code) : undefined;
      const searchBy = (codeFilter: ReturnType<typeof codeParam> | undefined) =>
        get('/database/search', discogsSearchSchema, {
          q: q.trim() || undefined,
          type: 'release',
          page,
          per_page: DISCOGS_PAGE_SIZE,
          year,
          format,
          country,
          ...codeFilter,
        });
      let data = await searchBy(lookup);
      // Some labels use all-digit catalog numbers: a barcode lookup that finds nothing tries that.
      if (code && lookup && 'barcode' in lookup && data.pagination.items === 0) {
        data = await searchBy({ catno: code.trim() });
      }
      return {
        results: data.results.flatMap((result) => mapSearchResult(result) ?? []),
        page: data.pagination.page,
        totalPages: Math.min(data.pagination.pages, MAX_SEARCH_PAGE),
        totalResults: data.pagination.items,
      };
    },

    async getById(externalId, category): Promise<NormalizedItem> {
      checkCategory(category);
      const { kind, id } = parseExternalId(externalId);
      const item =
        kind === 'release'
          ? mapRelease(await get(`/releases/${id}`, discogsReleaseSchema))
          : mapMaster(await get(`/masters/${id}`, discogsMasterSchema));
      if (!item) {
        throw new GatewayError('provider_error', 'discogs sent an item without a title.', {
          provider: 'discogs',
        });
      }
      return item;
    },
  };
}
