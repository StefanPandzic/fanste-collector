/** OAuth callback of the desktop app; its main process loads `/auth/callback` with the code. */
export const DESKTOP_OAUTH_REDIRECT = 'fanste://auth/callback';

/**
 * Where the OAuth provider (via Supabase) sends the user back to. In the browser that is this app's
 * `/auth/callback` route, carrying the page to open afterwards. The desktop app does the sign-in in
 * the system browser, which hands the code back through the `fanste://` deep link instead. That link
 * carries only the code (the desktop app drops every other parameter), so on desktop `next` is not
 * kept and Google sign-in always lands on the dashboard.
 */
export function oauthRedirectUrl(options: {
  origin: string;
  next: string;
  isDesktop: boolean;
}): string {
  if (options.isDesktop) return DESKTOP_OAUTH_REDIRECT;
  const url = new URL('/auth/callback', options.origin);
  url.searchParams.set('next', options.next);
  return url.href;
}
