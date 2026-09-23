/** The Next.js dev server (`pnpm --filter web dev`). */
export const DEFAULT_WEB_URL = 'http://localhost:3000';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Parses the URL of the web app the desktop window loads (`DESKTOP_WEB_URL`, defaulting to the dev
 * server). Its origin is the only one allowed in the window and on the preload bridge, so it must be
 * `https:`; plain `http:` is only accepted for loopback addresses.
 */
export function resolveWebUrl(value: string | undefined): URL {
  const raw = value || DEFAULT_WEB_URL;
  const url = URL.parse(raw);
  if (!url) {
    throw new Error(`DESKTOP_WEB_URL is not a valid URL: "${raw}"`);
  }
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
  ) {
    throw new Error(`DESKTOP_WEB_URL must be an https: URL (http: only for localhost): "${raw}"`);
  }
  return url;
}
