/** Custom URL scheme of the desktop app, e.g. `fanste://auth/callback?code=…` (OAuth). */
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

// Supabase auth codes are UUIDs today; any URL-safe token is accepted so a format change doesn't
// break sign-in (the exchange needs the PKCE verifier anyway). OAuth error codes are snake_case.
const AUTH_CODE = /^[\w.~-]{1,512}$/;
const AUTH_ERROR = /^[a-z_]{1,64}$/;

/**
 * Maps the OAuth deep link `fanste://auth/callback?code=…` to the web app's `/auth/callback` route on
 * `appOrigin`, which exchanges the code for a session in the app window (FC-06). Only the `code` (or
 * the provider's `error`) is carried over, so a crafted link can't add other parameters, such as a
 * `next` redirect. Returns `undefined` for any other deep link.
 *
 * A link with someone else's code can't sign the user in: the exchange also needs the PKCE code
 * verifier, a cookie the app window set when this user started the sign-in.
 */
export function authCallbackUrl(link: URL, appOrigin: string): URL | undefined {
  if (link.host !== 'auth' || link.pathname !== '/callback') return undefined;

  const url = new URL('/auth/callback', appOrigin);
  const code = link.searchParams.get('code');
  const error = link.searchParams.get('error');
  if (code && AUTH_CODE.test(code)) url.searchParams.set('code', code);
  else if (error && AUTH_ERROR.test(error)) url.searchParams.set('error', error);
  return url;
}
