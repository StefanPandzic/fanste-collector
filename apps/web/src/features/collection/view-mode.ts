'use client';

import { useCallback, useEffect, useState } from 'react';

/** How the gallery lays out items: cover grid or compact table. */
export type GalleryView = 'grid' | 'list';

export const DEFAULT_VIEW: GalleryView = 'grid';

/** Per user, so two accounts on one computer keep their own choice. */
export function galleryViewKey(userId: string): string {
  return `fanste:collection-view:${userId}`;
}

/** The stored view; the default when storage is unavailable or holds something else. */
export function loadGalleryView(storage: Storage | undefined, key: string): GalleryView {
  try {
    const stored = storage?.getItem(key);
    return stored === 'grid' || stored === 'list' ? stored : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The gallery view, remembered per user on this device (local storage). The default during SSR and
 * hydration.
 */
export function useGalleryView(userId: string): [GalleryView, (view: GalleryView) => void] {
  const key = galleryViewKey(userId);
  const [view, setViewState] = useState<GalleryView>(DEFAULT_VIEW);

  useEffect(() => {
    // Storage exists only in the browser, so the view is read after hydration.
    setViewState(loadGalleryView(browserStorage(), key));
  }, [key]);

  const setView = useCallback(
    (next: GalleryView) => {
      setViewState(next);
      try {
        browserStorage()?.setItem(key, next);
      } catch {
        // Storage is full or blocked; the choice lasts until reload.
      }
    },
    [key],
  );

  return [view, setView];
}
