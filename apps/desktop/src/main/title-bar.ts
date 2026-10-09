// Native window chrome. Pure, so it can be unit-tested; `window.ts` and `ipc.ts` apply it.

import type { DesktopOs, DesktopTheme } from '@fanste/core';

const DESKTOP_THEMES: readonly DesktopTheme[] = ['light', 'dark', 'system'];

/** Height of the web app's top bar (`h-14`), which doubles as the window's drag region. */
export const TITLE_BAR_HEIGHT = 56;

/** `--background` of the shared theme, so the window doesn't flash white before the page paints. */
export const WINDOW_BACKGROUND = { light: '#ffffff', dark: '#09090b' } as const;

/** Validates a theme sent by the renderer through `window.fanste.window.setTheme()`. */
export function parseDesktopTheme(value: unknown): DesktopTheme {
  if (DESKTOP_THEMES.includes(value as DesktopTheme)) return value as DesktopTheme;
  throw new TypeError('Expected "light", "dark" or "system"');
}

/** Colors of the Windows/Linux window-controls overlay, matching the top bar. */
export function titleBarOverlay(dark: boolean) {
  return {
    color: dark ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light,
    symbolColor: dark ? '#fafafa' : '#18181b',
    height: TITLE_BAR_HEIGHT,
  };
}

/**
 * `BrowserWindow` options that hide the OS title bar, so the web app's top bar takes its place:
 * - macOS keeps the traffic lights, inset and centered in the top bar;
 * - Windows and Linux draw the window controls as an overlay in the top-right corner.
 */
export function titleBarOptions(os: DesktopOs, dark: boolean) {
  if (os === 'macos') {
    return {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: (TITLE_BAR_HEIGHT - 16) / 2 },
    };
  }
  return { titleBarStyle: 'hidden' as const, titleBarOverlay: titleBarOverlay(dark) };
}
