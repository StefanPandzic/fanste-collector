import { shell } from 'electron';

import { canOpenExternally, isAppUrl, isPermissionAllowed } from './url-policy';

import type { Session, WebContents } from 'electron';

/**
 * Keeps the window on the web app's origin: navigations elsewhere and `window.open` / `target=_blank`
 * links open in the system browser instead (only `http:`, `https:`, `mailto:`).
 */
export function restrictNavigation(contents: WebContents, appOrigin: string): void {
  contents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event) => {
    if (isAppUrl(event.url, appOrigin)) return;
    event.preventDefault();
    openExternally(event.url);
  });

  contents.on('will-redirect', (event) => {
    if (!event.isMainFrame || isAppUrl(event.url, appOrigin)) return;
    event.preventDefault();
    openExternally(event.url);
  });
}

/** Denies every permission except the few the web app needs, and those only for the app origin. */
export function restrictPermissions(session: Session, appOrigin: string): void {
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(isPermissionAllowed(permission, details.requestingUrl, appOrigin));
  });
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    isPermissionAllowed(permission, requestingOrigin, appOrigin),
  );
}

function openExternally(url: string): void {
  if (!canOpenExternally(url)) {
    console.warn(`[security] Blocked opening ${url}`);
    return;
  }
  shell.openExternal(url).catch((error: unknown) => {
    console.error(`[security] Could not open ${url}`, error);
  });
}
