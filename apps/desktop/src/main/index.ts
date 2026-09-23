import path from 'node:path';

import { app, session } from 'electron';

import { DEEP_LINK_PROTOCOL, findDeepLink, parseDeepLink } from './deep-link';
import { registerIpcHandlers } from './ipc';
import { restrictPermissions } from './security';
import { resolveWebUrl } from './web-url';
import { createMainWindow } from './window';

import type { BrowserWindow } from 'electron';

/** Must match `appId` in `electron-builder.yml`. */
const APP_ID = 'com.fanste.collector';

const webUrl = resolveWebUrl(import.meta.env.DESKTOP_WEB_URL);
let mainWindow: BrowserWindow | undefined;

if (!app.requestSingleInstanceLock()) {
  // Another instance is already running. It gets our argv (and so any deep link) via `second-instance`.
  app.quit();
} else {
  registerDeepLinkProtocol();

  app.on('second-instance', (_event, argv) => {
    showMainWindow();
    const link = findDeepLink(argv);
    if (link) handleDeepLink(link);
  });

  // macOS delivers deep links as an event instead, possibly before `ready`.
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
    registerIpcHandlers(webUrl.origin);
    showMainWindow();

    // Windows/Linux: the app was launched by opening a deep link.
    const link = findDeepLink(process.argv);
    if (link) handleDeepLink(link);

    // macOS: clicking the dock icon with no windows open.
    app.on('activate', showMainWindow);
  });
}

/** Focuses the app window, creating it if needed. */
function showMainWindow(): void {
  if (!app.isReady()) return;
  if (!mainWindow) {
    mainWindow = createMainWindow(webUrl);
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

function handleDeepLink(link: URL): void {
  // FC-06 forwards `fanste://auth/callback?code=…` to the renderer to finish OAuth sign-in.
  // The query isn't logged, since it can contain an auth code.
  console.info(`[deep-link] Received ${link.protocol}//${link.host}${link.pathname}`);
  showMainWindow();
}
