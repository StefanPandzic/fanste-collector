'use client';

import { useCallback, useEffect, useState } from 'react';

import { addRecentSearch, parseRecentSearches, removeRecentSearch } from '@fanste/core';

import type { RecentSearch } from '@fanste/core';

/** Per user, so two accounts on one computer don't see each other's searches. */
export function recentSearchesKey(userId: string): string {
  return `fanste:recent-searches:${userId}`;
}

/** The stored list; empty when storage is unavailable (private mode, blocked site data) or invalid. */
export function loadRecentSearches(storage: Storage | undefined, key: string): RecentSearch[] {
  try {
    const raw = storage?.getItem(key);
    return raw ? parseRecentSearches(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** Stores the list; failures are ignored, because recent searches are only a convenience. */
export function saveRecentSearches(
  storage: Storage | undefined,
  key: string,
  list: readonly RecentSearch[],
): void {
  try {
    if (list.length === 0) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(list));
  } catch {
    // Storage is full or blocked.
  }
}

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The user's recent searches on this device (local storage). Empty during SSR and hydration. */
export function useRecentSearches(userId: string) {
  const key = recentSearchesKey(userId);
  const [list, setList] = useState<RecentSearch[]>([]);

  useEffect(() => {
    // Storage exists only in the browser, so the list is read after hydration.
    setList(loadRecentSearches(browserStorage(), key));
  }, [key]);

  const update = useCallback(
    (change: (current: RecentSearch[]) => RecentSearch[]) => {
      setList((current) => {
        const next = change(current);
        saveRecentSearches(browserStorage(), key, next);
        return next;
      });
    },
    [key],
  );

  return {
    recent: list,
    add: useCallback(
      (entry: RecentSearch) => update((current) => addRecentSearch(current, entry)),
      [update],
    ),
    remove: useCallback(
      (entry: RecentSearch) => update((current) => removeRecentSearch(current, entry)),
      [update],
    ),
    clear: useCallback(() => update(() => []), [update]),
  };
}
