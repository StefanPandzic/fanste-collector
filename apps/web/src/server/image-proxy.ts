import { isProxiedImageUrl } from '@fanste/core';

import { GatewayError } from './errors';
import { IMAGE_PROXY } from './limits';

// The image proxy behind `GET /api/image?url=` (FC-26): it fetches a provider cover whose host sends
// no CORS headers, so the PDF export can draw it into a canvas. Only `IMAGE_PROXY_HOSTS` are
// fetched, redirects included, and only image responses up to `IMAGE_PROXY.maxBytes` are passed on.

/** The image types the proxy passes on. SVG is left out: it can carry scripts. */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX_REDIRECTS = 3;

export interface ProxiedImage {
  body: Uint8Array;
  contentType: string;
}

/** The `url` query parameter as an allowed image URL; throws `bad_request` otherwise. */
export function parseImageUrl(value: string | null): URL {
  if (!value || !isProxiedImageUrl(value)) {
    throw new GatewayError('bad_request', 'This image host is not supported.');
  }
  return new URL(value);
}

/** Reads a response body, stopping with `provider_error` past `maxBytes`. */
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new GatewayError('provider_error', 'The image is too large.');
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new GatewayError('provider_error', 'The image is too large.');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Fetches an image from an allowed host. Each redirect must stay on an allowed host. A missing image
 * is `not_found`; anything else that isn't an image is `provider_error`.
 */
export async function fetchProxiedImage(
  url: URL,
  { userAgent, fetchImpl = fetch }: { userAgent: string; fetchImpl?: typeof fetch },
): Promise<ProxiedImage> {
  let current = url;
  for (let redirects = 0; ; redirects += 1) {
    let response: Response;
    try {
      response = await fetchImpl(current, {
        redirect: 'manual',
        headers: { 'User-Agent': userAgent, Accept: IMAGE_TYPES.join(', ') },
        signal: AbortSignal.timeout(IMAGE_PROXY.timeoutMs),
      });
    } catch (error) {
      throw new GatewayError('provider_error', "The image couldn't be loaded.", { cause: error });
    }

    // Only an image's body is read; the others are released so the connection is freed.
    const discard = () => response.body?.cancel().catch(() => undefined);
    if (response.status >= 300 && response.status < 400) {
      void discard();
      const location = response.headers.get('location');
      const next = location ? new URL(location, current).toString() : '';
      if (redirects >= MAX_REDIRECTS || !isProxiedImageUrl(next)) {
        throw new GatewayError('provider_error', "The image couldn't be loaded.");
      }
      current = new URL(next);
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      void discard();
      throw new GatewayError('not_found', 'The image no longer exists.');
    }
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!response.ok || !contentType || !IMAGE_TYPES.includes(contentType)) {
      void discard();
      throw new GatewayError('provider_error', "The image couldn't be loaded.");
    }
    try {
      return { body: await readCapped(response, IMAGE_PROXY.maxBytes), contentType };
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      // A timeout or a dropped connection while reading the body.
      throw new GatewayError('provider_error', "The image couldn't be loaded.", { cause: error });
    }
  }
}
