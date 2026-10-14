'use client';

import { useQuery } from '@tanstack/react-query';

import { useCollectionContext } from '@fanste/collection';

import type { GamePlatform } from '@fanste/core';

/**
 * Every IGDB platform (`GET /api/platforms/igdb`, FC-11), for a game copy's platform field and the
 * game search's platform filter. Loaded once per session (and only while `enabled`); while it loads,
 * or if it fails, callers offer the game's own or the popular platforms.
 */
export function useGamePlatforms(enabled = true): GamePlatform[] | undefined {
  const { api } = useCollectionContext();
  const query = useQuery({
    queryKey: ['igdb-platforms'],
    queryFn: ({ signal }) => api.getGamePlatforms({ signal }),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
    enabled,
  });
  return query.data?.platforms;
}
