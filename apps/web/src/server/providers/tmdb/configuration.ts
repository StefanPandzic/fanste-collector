import { gatewayLog } from '../../log';

/** Where TMDB serves poster images, from `/configuration`. */
export interface TmdbImageConfig {
  /** HTTPS base URL ending in `/`, e.g. `https://image.tmdb.org/t/p/`. */
  baseUrl: string;
  /** Available poster widths, e.g. `w185`, `w500`, `original`. */
  posterSizes: readonly string[];
}

/** TMDB's documented values, used until (or if) `/configuration` can't be loaded. */
export const DEFAULT_IMAGE_CONFIG: TmdbImageConfig = {
  baseUrl: 'https://image.tmdb.org/t/p/',
  posterSizes: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
};

export const POSTER_SIZE = 'w500';
export const THUMBNAIL_SIZE = 'w185';

/** How long a loaded `/configuration` is reused. TMDB changes it very rarely. */
export const CONFIGURATION_TTL_MS = 24 * 60 * 60 * 1000;

const widthOf = (size: string) => Number(/^w(\d+)$/.exec(size)?.[1] ?? Number.NaN);

/** `wanted` if TMDB offers it, else the closest width it offers, else `original`. */
export function pickPosterSize(sizes: readonly string[], wanted: string): string {
  if (sizes.includes(wanted)) return wanted;
  const target = widthOf(wanted);
  const widths = sizes.filter((size) => !Number.isNaN(widthOf(size)));
  const closest = widths.reduce<string | undefined>(
    (best, size) =>
      best === undefined || Math.abs(widthOf(size) - target) < Math.abs(widthOf(best) - target)
        ? size
        : best,
    undefined,
  );
  return closest ?? 'original';
}

/** Full poster URL for a TMDB `poster_path` (`/abc.jpg`), or `undefined` when there is none. */
export function posterUrl(
  config: TmdbImageConfig,
  path: string | null | undefined,
  size: string,
): string | undefined {
  if (!path?.startsWith('/')) return undefined;
  const base = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
  return `${base}${pickPosterSize(config.posterSizes, size)}${path}`;
}

/**
 * Loads `/configuration` once and reuses it for `CONFIGURATION_TTL_MS`. Concurrent callers share one
 * request. When loading fails, the defaults are used and the next call tries again.
 */
export function createImageConfigLoader(
  load: () => Promise<TmdbImageConfig>,
  now: () => number = Date.now,
): () => Promise<TmdbImageConfig> {
  let cached: { config: TmdbImageConfig; loadedAt: number } | undefined;
  let inFlight: Promise<TmdbImageConfig> | undefined;

  return () => {
    if (cached && now() - cached.loadedAt < CONFIGURATION_TTL_MS) {
      return Promise.resolve(cached.config);
    }
    inFlight ??= load()
      .then((config) => {
        cached = { config, loadedAt: now() };
        return config;
      })
      .catch((error: unknown) => {
        gatewayLog.warn('tmdb.configuration_failed', {
          reason: error instanceof Error ? error.message : String(error),
        });
        return cached?.config ?? DEFAULT_IMAGE_CONFIG;
      })
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };
}
