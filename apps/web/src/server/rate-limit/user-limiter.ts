export interface UserLimiterOptions {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
  /** Tracked keys before idle ones are swept, so memory stays bounded. */
  maxKeys?: number;
}

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface UserLimiter {
  /** Counts a request for `key` (the user ID) and says whether it may go ahead. */
  check(key: string, now?: number): LimitResult;
}

/**
 * Sliding-window rate limiter kept in memory. Each serverless instance has its own, so the limit is
 * best effort (FC-08 Notes); a global one would need a shared store such as Redis.
 */
export function createUserLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: UserLimiterOptions): UserLimiter {
  const hits = new Map<string, number[]>();

  function sweep(now: number) {
    for (const [key, times] of hits) {
      if ((times.at(-1) ?? 0) <= now - windowMs) hits.delete(key);
    }
  }

  return {
    check(key, now = Date.now()) {
      const times = (hits.get(key) ?? []).filter((time) => time > now - windowMs);
      if (times.length >= limit) {
        hits.set(key, times);
        const oldest = times[0] ?? now;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
        };
      }
      times.push(now);
      hits.set(key, times);
      if (hits.size > maxKeys) sweep(now);
      return { allowed: true };
    },
  };
}
