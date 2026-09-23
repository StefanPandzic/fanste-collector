/** Custom URL scheme of the desktop app, e.g. `fanste://auth/callback?code=…` (OAuth, FC-06). */
export const DEEP_LINK_PROTOCOL = 'fanste';

/** Parses a `fanste://…` URL; `undefined` for anything else. */
export function parseDeepLink(value: string): URL | undefined {
  const url = URL.parse(value);
  return url?.protocol === `${DEEP_LINK_PROTOCOL}:` ? url : undefined;
}

/**
 * Finds a deep link in command-line arguments. Windows and Linux open deep links by launching the
 * app with the URL as an argument; a running instance receives that argv via `second-instance`.
 */
export function findDeepLink(argv: readonly string[]): URL | undefined {
  for (const arg of argv) {
    const url = parseDeepLink(arg);
    if (url) return url;
  }
  return undefined;
}
