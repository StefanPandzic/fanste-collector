import path from 'node:path';

import { app, session } from 'electron';

import { authCallbackUrl, DEEP_LINK_PROTOCOL, findDeepLink, parseDeepLink } from './deep-link';
import { registerIpcHandlers } from './ipc';
import { ScannerService } from './scanner/scanner-service';
import { restrictPermissions } from './security';
import { resolveWebUrl } from './web-url';
import { createMainWindow, loadWebApp } from './window';
import { toDesktopOs } from '../shared/platform';

import type { BrowserWindow } from 'electron';

/** Must match `appId` in `electron-builder.yml`. */
const APP_ID = 'com.fanste.collector';

const webUrl = resolveWebUrl(import.meta.env.DESKTOP_WEB_URL);
let mainWindow: BrowserWindow | undefined;
/** A web app page to open once the window exists (an OAuth callback that arrived before `ready`). */
let pendingUrl: URL | undefined;

if (!app.requestSingleInstanceLock()) {
  // Another instance is already running. It gets our argv (and so any deep link) via `second-instance`.
  app.quit();
} else {
  registerDeepLinkProtocol();

  app.on('second-instance', (_event, argv) => {
    const link = findDeepLink(argv);
    if (link) handleDeepLink(link);
    else showMainWindow();
  });

  // macOS delivers deep links as an event instead, possibly before `ready` (cold start from a link).
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const link = parseDeepLink(url);
    if (link) handleDeepLink(link);
  });

  app.on('window-all-closed', () => {
    // macOS apps stay active without windows until the user quits with Cmd+Q.
    if (process.platform !== 'darwin') app.quit();
  });

  void app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

    restrictPermissions(session.defaultSession, webUrl.origin);
    registerIpcHandlers(
      webUrl.origin,
      new ScannerService(
        path.join(app.getPath('userData'), 'scanner.json'),
        toDesktopOs(process.platform),
      ),
    );

    // Windows/Linux: the app was launched by opening a deep link. Handled before the window is
    // created, so the window opens the link's page instead of loading the start page first.
    const link = findDeepLink(process.argv);
    if (link) handleDeepLink(link);
    else showMainWindow();

    // macOS: clicking the dock icon with no windows open.
    app.on('activate', showMainWindow);
  });
}

/** Focuses the app window, creating it if needed. */
function showMainWindow(): void {
  if (!app.isReady()) return;
  if (!mainWindow) {
    mainWindow = createMainWindow(webUrl, pendingUrl);
    pendingUrl = undefined;
    mainWindow.on('closed', () => {
      mainWindow = undefined;
    });
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function registerDeepLinkProtocol(): void {
  if (process.defaultApp) {
    // Unpackaged, the OS must launch `electron <app dir> <url>` rather than just `electron <url>`.
    const appDir = process.argv[1];
    if (appDir) {
      app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, process.execPath, [path.resolve(appDir)]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  }
}

/**
 * Handles a `fanste://` link. `fanste://auth/callback?code=…` (Google sign-in, which runs in the
 * system browser) opens the web app's `/auth/callback` in the window, which finishes the sign-in.
 * The query isn't logged, since it can contain an auth code.
 */
function handleDeepLink(link: URL): void {
  console.info(`[deep-link] Received ${link.protocol}//${link.host}${link.pathname}`);
  const target = authCallbackUrl(link, webUrl.origin);

  if (target && mainWindow) {
    void loadWebApp(mainWindow, target);
  } else if (target) {
    pendingUrl = target;
  }
  showMainWindow();
}
