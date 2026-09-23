import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { app, BrowserWindow, nativeTheme, screen } from 'electron';

import { APP_NAME } from '@fanste/core';

import { restrictNavigation } from './security';
import { isOnScreen, readWindowState, writeWindowState } from './window-state';

const DEFAULT_SIZE = { width: 1280, height: 800 };
const MIN_SIZE = { width: 768, height: 560 };
// `--background` of the shared theme, so the window doesn't flash white before the page paints.
const BACKGROUND_COLOR = { light: '#ffffff', dark: '#09090b' };

/** Creates the app window, restores its last position and size, and loads the web app. */
export function createMainWindow(webUrl: URL): BrowserWindow {
  const stateFile = path.join(app.getPath('userData'), 'window-state.json');
  const saved = readWindowState(stateFile);
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  const restored = saved && isOnScreen(saved.bounds, workAreas) ? saved : undefined;

  const window = new BrowserWindow({
    ...(restored?.bounds ?? DEFAULT_SIZE),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    title: APP_NAME,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors
      ? BACKGROUND_COLOR.dark
      : BACKGROUND_COLOR.light,
    // Windows/Linux: the menu bar appears when Alt is pressed.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.cjs'),
      // The renderer is a remote web page: no Node.js, and only `window.fanste` from the preload.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });

  window.once('ready-to-show', () => {
    if (restored?.isMaximized) window.maximize();
    else window.show();
  });

  window.on('close', () => {
    try {
      writeWindowState(stateFile, {
        bounds: window.getNormalBounds(),
        isMaximized: window.isMaximized(),
      });
    } catch (error) {
      console.warn('[window] Could not save window state', error);
    }
  });

  restrictNavigation(window.webContents, webUrl.origin);
  void loadWebApp(window, webUrl);

  return window;
}

/**
 * Loads the web app. Unpackaged builds wait for the web server, which `pnpm dev:desktop` starts at
 * the same time as Electron.
 */
async function loadWebApp(window: BrowserWindow, webUrl: URL): Promise<void> {
  let waiting = false;
  for (;;) {
    try {
      await window.loadURL(webUrl.href);
      return;
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      // The page started another navigation (e.g. a redirect) before this one finished.
      if (code === 'ERR_ABORTED' || window.isDestroyed()) return;

      if (!app.isPackaged && code === 'ERR_CONNECTION_REFUSED') {
        if (!waiting) console.info(`[window] Waiting for the web app at ${webUrl.origin} …`);
        waiting = true;
        await delay(1000);
        if (window.isDestroyed()) return;
        continue;
      }

      console.error(`[window] Could not load ${webUrl.href}`, error);
      window.show();
      return;
    }
  }
}
