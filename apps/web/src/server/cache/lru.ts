export interface LruCacheOptions {
  maxEntries: number;
  ttlMs: number;
}

export interface LruCache<V> {
  get(key: string, now?: number): V | undefined;
  set(key: string, value: V, now?: number): void;
}

/**
 * A small in-memory LRU cache with a TTL, kept per server instance. A `Map` iterates in insertion
 * order, so re-inserting on read keeps the least recently used entry first.
 */
export function createLruCache<V>({ maxEntries, ttlMs }: LruCacheOptions): LruCache<V> {
  const entries = new Map<string, { value: V; expiresAt: number }>();

  return {
    get(key, now = Date.now()) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expiresAt <= now) return undefined;
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value, now = Date.now()) {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
  };
}
