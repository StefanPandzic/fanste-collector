import type { Route } from 'next';

/** Where signed-in users land by default (after sign-in, or when they open a guest-only page). */
export const DEFAULT_SIGNED_IN_PATH = '/dashboard' satisfies Route;
export const SIGN_IN_PATH = '/sign-in' satisfies Route;

/** Pages only for signed-out users; signed-in users are sent to {@link DEFAULT_SIGNED_IN_PATH}. */
const GUEST_ONLY_PATHS = new Set<string>(['/sign-in', '/sign-up', '/forgot-password']);

/** Public pages, matched exactly. Reset-password explains an expired link instead of redirecting. */
const PUBLIC_PATHS = new Set<string>(['/reset-password']);

/**
 * Path prefixes open to everyone, which check the session themselves if they need one: the auth
 * route handlers, and the API gateway (FC-08), which answers with 401 rather than a redirect.
 */
const PUBLIC_PREFIXES = ['/auth/', '/api/'];

export type RouteAccess = 'guest-only' | 'public' | 'protected';

/** How the proxy treats a request path. Everything that isn't guest-only or public needs a session. */
export function routeAccess(pathname: string): RouteAccess {
  if (GUEST_ONLY_PATHS.has(pathname)) return 'guest-only';
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return 'public';
  }
  return 'protected';
}

// Only used to resolve relative paths; never part of a returned value.
const BASE = 'http://internal.invalid';

/**
 * Returns `value` if it is a same-origin path (e.g. the `next` query parameter after sign-in),
 * otherwise `fallback`. Guards against open redirects such as `//evil.com` or `/\evil.com`.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: Route = DEFAULT_SIGNED_IN_PATH,
): Route {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  const url = URL.parse(value, BASE);
  if (url?.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}` as Route;
}

/** The sign-in page URL that returns to `next` afterwards. */
export function signInPathFor(next: string): Route {
  const path = safeNextPath(next);
  if (path === DEFAULT_SIGNED_IN_PATH) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?${new URLSearchParams({ next: path }).toString()}` as Route;
}
