import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONFIGURATION_TTL_MS,
  createImageConfigLoader,
  DEFAULT_IMAGE_CONFIG,
  pickPosterSize,
  posterUrl,
} from './configuration';

import type { TmdbImageConfig } from './configuration';

const loadedConfig: TmdbImageConfig = {
  baseUrl: 'https://image.tmdb.org/t/p/',
  posterSizes: ['w92', 'w185', 'w500', 'original'],
};
const inceptionPoster = '/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pickPosterSize', () => {
  it('returns the wanted size when TMDB offers it, else the closest width', () => {
    expect(pickPosterSize(loadedConfig.posterSizes, 'w500')).toBe('w500');
    expect(pickPosterSize(loadedConfig.posterSizes, 'w400')).toBe('w500');
    expect(pickPosterSize(['original'], 'w185')).toBe('original');
  });
});

describe('posterUrl', () => {
  it('builds the full poster URL', () => {
    expect(posterUrl(loadedConfig, inceptionPoster, 'w185')).toBe(
      `https://image.tmdb.org/t/p/w185${inceptionPoster}`,
    );
  });

  it('returns undefined when there is no poster', () => {
    expect(posterUrl(loadedConfig, null, 'w185')).toBeUndefined();
  });
});

describe('createImageConfigLoader', () => {
  it('shares one request and reuses the result until the TTL expires', async () => {
    let time = 0;
    const load = vi.fn(() => Promise.resolve(loadedConfig));
    const imageConfig = createImageConfigLoader(load, () => time);

    const [first, second] = await Promise.all([imageConfig(), imageConfig()]);
    expect(first).toEqual(loadedConfig);
    expect(second).toEqual(loadedConfig);
    expect(load).toHaveBeenCalledTimes(1);

    time = CONFIGURATION_TTL_MS + 1;
    await imageConfig();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('falls back to the defaults on failure and retries on the next call', async () => {
    const load = vi
      .fn<() => Promise<TmdbImageConfig>>()
      .mockRejectedValueOnce(new Error('tmdb could not be reached.'))
      .mockResolvedValueOnce(loadedConfig);
    const imageConfig = createImageConfigLoader(load);

    expect(await imageConfig()).toEqual(DEFAULT_IMAGE_CONFIG);
    expect(await imageConfig()).toEqual(loadedConfig);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
