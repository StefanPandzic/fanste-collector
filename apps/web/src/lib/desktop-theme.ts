import type { DesktopTheme } from '@fanste/core';

/**
 * Maps the next-themes setting (`theme` from `useTheme()`, any string or `undefined` before
 * mount) to the theme the desktop window understands, or `undefined` if there's none to send.
 */
export function toDesktopTheme(theme: string | undefined): DesktopTheme | undefined {
  return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : undefined;
}
