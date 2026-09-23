'use client';

import { useIsDesktop } from '@/lib/platform';

import type { ReactNode } from 'react';

interface DesktopOnlyProps {
  children: ReactNode;
  /** Rendered in the browser (and during server rendering) instead of `children`. */
  fallback: ReactNode;
}

/** Renders `children` only inside the desktop app, e.g. for features that need local file access. */
export function DesktopOnly({ children, fallback }: DesktopOnlyProps) {
  return useIsDesktop() ? children : fallback;
}
