import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GatewayError } from './errors';
import { capPerProvider, createItemService } from './items';
import { createRegistry } from './providers/registry';

import type { CachedItem, MetadataCacheStore } from './cache/metadata-cache';
import type { ProviderAdapter } from './providers/types';
import type { ItemCategory, ItemRef, NormalizedItem } from '@fanste/core';

const now = new Date('2026-10-09T12:00:00Z');
const longAgo = new Date('2026-01-01T12:00:00Z');
const matrixRef: ItemRef = { provider: 'tmdb', externalId: 'movie:603' };

function movie(externalId: string): NormalizedItem {
  return { provider: 'tmdb', externalId, category: 'movie', title: `TMDB ${externalId}` };
}

function boardGames(count: number): ItemRef[] {
  return Array.from({ length: count }, (_, index) => ({
    provider: 'bgg' as const,
    externalId: String(13 + index),
  }));
}

function setup(cached: CachedItem[] | 'cache down') {
  const getById = vi.fn((externalId: string, category: ItemCategory) =>
    externalId === 'movie:999999'
      ? Promise.reject(new GatewayError('not_found', 'tmdb has no such item.'))
      : Promise.resolve<NormalizedItem>({
          ...movie(externalId),
          provider: category === 'board_game' ? 'bgg' : 'tmdb',
          category,
        }),
  );
  const tmdbAdapter: ProviderAdapter = {
    provider: 'tmdb',
    categories: ['movie', 'tv'],
    search: () => Promise.reject(new Error('not used')),
    getById,
  };
  const bggAdapter: ProviderAdapter = {
    ...tmdbAdapter,
    provider: 'bgg',
    categories: ['board_game'],
  };
  const cache = {
    getMany: vi.fn((refs: readonly ItemRef[]) =>
      cached === 'cache down'
        ? Promise.reject(new Error('metadata_cache read failed: fetch failed'))
        : Promise.resolve(
            cached.filter(({ item }) => refs.some((ref) => ref.externalId === item.externalId)),
          ),
    ),
    upsert: vi.fn<MetadataCacheStore['upsert']>(() => Promise.resolve()),
  };
  const background: (() => Promise<void>)[] = [];
  const service = createItemService({
    registry: createRegistry([tmdbAdapter, bggAdapter]),
    cache,
    runInBackground: (task) => background.push(task),
    now: () => now,
  });
  return { service, getById, cache, background };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('capPerProvider', () => {
  it('keeps each provider within its per-request fetch budget', () => {
    const games = boardGames(5);
    expect(capPerProvider([matrixRef, ...games])).toEqual({
      within: [matrixRef, ...games.slice(0, 3)],
      over: games.slice(3),
    });
  });
});

describe('createItemService', () => {
  it('returns a fresh cached item without calling the provider', async () => {
    const { service, getById, background } = setup([{ item: movie('movie:603'), fetchedAt: now }]);
    expect(await service.getItem(matrixRef)).toEqual(movie('movie:603'));
    expect(getById).not.toHaveBeenCalled();
    expect(background).toHaveLength(0);
  });

  it('returns a stale item at once and refreshes it in the background', async () => {
    const stale = { ...movie('movie:603'), title: 'Old title' };
    const { service, getById, cache, background } = setup([{ item: stale, fetchedAt: longAgo }]);
    expect(await service.getItem(matrixRef)).toEqual(stale);
    expect(background).toHaveLength(1);

    await background[0]?.();
    expect(getById).toHaveBeenCalledWith('movie:603', 'movie');
    expect(cache.upsert).toHaveBeenCalledWith([movie('movie:603')]);
  });

  it('fetches and stores a cache miss', async () => {
    const { service, getById, cache } = setup([]);
    expect(await service.getItem(matrixRef)).toEqual(movie('movie:603'));
    expect(getById).toHaveBeenCalledTimes(1);
    expect(cache.upsert).toHaveBeenCalledWith([movie('movie:603')]);
  });

  it('serves a batch of 50 fresh cached items without provider calls', async () => {
    const refs = Array.from({ length: 50 }, (_, index) => ({
      provider: 'tmdb' as const,
      externalId: `movie:${index + 1}`,
    }));
    const { service, getById, cache } = setup(
      refs.map((ref) => ({ item: movie(ref.externalId), fetchedAt: now })),
    );
    const response = await service.getItemsBatch(refs);
    expect(response.items).toHaveLength(50);
    expect(response.missing).toEqual([]);
    expect(cache.getMany).toHaveBeenCalledTimes(1);
    expect(getById).not.toHaveBeenCalled();
  });

  it('fetches batch misses and lists the failed ones as missing', async () => {
    const { service, getById, cache } = setup([{ item: movie('movie:603'), fetchedAt: now }]);
    const unknownRef: ItemRef = { provider: 'tmdb', externalId: 'movie:999999' };
    const response = await service.getItemsBatch([
      matrixRef,
      { provider: 'tmdb', externalId: 'movie:604' },
      unknownRef,
    ]);
    expect(response.items).toEqual([movie('movie:603'), movie('movie:604')]);
    expect(response.missing).toEqual([{ ...unknownRef, reason: 'not_found' }]);
    expect(getById).toHaveBeenCalledTimes(2);
    expect(cache.upsert).toHaveBeenCalledWith([movie('movie:604')]);
  });

  it('lists batch misses over the provider cap as missing without fetching them', async () => {
    const { service, getById } = setup([]);
    const games = boardGames(5);
    const response = await service.getItemsBatch(games);
    expect(getById).toHaveBeenCalledTimes(3);
    expect(response.items).toHaveLength(3);
    expect(response.missing).toEqual(
      games.slice(3).map((ref) => ({ ...ref, reason: 'retry_later' })),
    );
  });

  it('fetches from the providers when the cache read fails', async () => {
    const { service, getById } = setup('cache down');
    expect(await service.getItem(matrixRef)).toEqual(movie('movie:603'));
    const response = await service.getItemsBatch([{ provider: 'tmdb', externalId: 'movie:604' }]);
    expect(response.items).toEqual([movie('movie:604')]);
    expect(getById).toHaveBeenCalledTimes(2);
  });
});
