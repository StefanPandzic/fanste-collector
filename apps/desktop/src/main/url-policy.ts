/**
 * Which URLs and permissions the app window accepts. Kept free of Electron imports so it can be
 * unit-tested; `./security.ts` applies these rules to Electron.
 */

/** `true` if `url` is on the web app's origin, i.e. may be shown in the app window and call the bridge. */
export function isAppUrl(url: string, appOrigin: string): boolean {
  return URL.parse(url)?.origin === appOrigin;
}

const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/** `true` if `url` may be handed to the OS (system browser / mail client). */
export function canOpenExternally(url: string): boolean {
  const protocol = URL.parse(url)?.protocol;
  return protocol !== undefined && EXTERNAL_PROTOCOLS.has(protocol);
}

/** Permissions the web app may use; everything else (camera, geolocation, notifications, …) is denied. */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen']);

/** `true` if the app origin may use `permission`. Other origins (e.g. embedded iframes) get none. */
export function isPermissionAllowed(
  permission: string,
  requestingUrl: string,
  appOrigin: string,
): boolean {
  return ALLOWED_PERMISSIONS.has(permission) && isAppUrl(requestingUrl, appOrigin);
}
