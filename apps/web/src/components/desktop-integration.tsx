'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

import { toDesktopTheme } from '@/lib/desktop-theme';
import { useIsDesktop } from '@/lib/platform';

import type { DesktopWindowApi } from '@fanste/core';

/**
 * Desktop-app wiring with no UI:
 * - sets `data-desktop-os` on `<html>`, which turns on the desktop styles in `globals.css` (drag
 *   region, window-control spacing, scrollbars, no text selection on chrome);
 * - keeps the native window chrome in sync with the theme toggle.
 */
export function DesktopIntegration() {
  const isDesktop = useIsDesktop();
  const { theme } = useTheme();

  useEffect(() => {
    const bridge = window.fanste;
    if (!isDesktop || !bridge) return;
    const root = document.documentElement;
    root.dataset.desktopOs = bridge.platform.os;
    return () => {
      delete root.dataset.desktopOs;
    };
  }, [isDesktop]);

  useEffect(() => {
    const desktopTheme = toDesktopTheme(theme);
    if (!isDesktop || !desktopTheme) return;
    // The desktop app loads the deployed web app, so an older desktop build may lack this method.
    const setTheme = (window.fanste?.window as Partial<DesktopWindowApi> | undefined)?.setTheme;
    setTheme?.(desktopTheme).catch((error: unknown) => {
      console.warn('[desktop] Could not sync the window theme', error);
    });
  }, [isDesktop, theme]);

  return null;
}
