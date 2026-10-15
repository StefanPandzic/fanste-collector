// `GET /api/image?url=` (FC-26): the gateway's image proxy for provider covers whose hosts send no
// CORS headers, so the browser can't draw them into a canvas for the PDF export. Only these hosts
// are proxied; TMDB, IGDB and Supabase Storage send CORS headers and are fetched directly.

/** Cover hosts the gateway proxies: Discogs (FC-10) and BoardGameGeek (FC-12). */
export const IMAGE_PROXY_HOSTS = ['i.discogs.com', 'cf.geekdo-images.com'] as const;

/** The gateway's image proxy route. */
export const IMAGE_PROXY_PATH = '/api/image';

/** Longest image URL the proxy takes. */
export const MAX_IMAGE_PROXY_URL_LENGTH = 2048;

/** Whether `url` is an `https` URL on one of the `IMAGE_PROXY_HOSTS`. */
export function isProxiedImageUrl(url: string): boolean {
  if (url.length > MAX_IMAGE_PROXY_URL_LENGTH) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === 'https:' &&
    parsed.port === '' &&
    parsed.username === '' &&
    parsed.password === '' &&
    (IMAGE_PROXY_HOSTS as readonly string[]).includes(parsed.hostname)
  );
}

/**
 * Where the browser loads a cover from: the proxy (same origin) for `IMAGE_PROXY_HOSTS`, else the
 * URL itself.
 */
export function coverFetchUrl(url: string): string {
  return isProxiedImageUrl(url) ? `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(url)}` : url;
}
