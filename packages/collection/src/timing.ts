/** Delay before reconnect attempt `attempt` (0-based): 1 s, 2 s, 4 s, … capped at 30 s. */
export function reconnectDelay(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}

/** Delay before retrying metadata the gateway deferred (`retry_later`), or `false` to stop. */
export function metadataRetryDelay(attempt: number, maxAttempts = 5): number | false {
  return attempt >= maxAttempts ? false : Math.min(60_000, 2000 * 2 ** attempt);
}

export interface Batcher<T> {
  push(value: T): void;
  /** Drops the pending values without flushing them. */
  cancel(): void;
}

/**
 * Collects values and flushes them together once none has arrived for `delayMs`, so a burst (a bulk
 * delete, a scanner import) causes one refetch instead of hundreds.
 */
export function createBatcher<T>(delayMs: number, flush: (values: T[]) => void): Batcher<T> {
  let pending: T[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    push(value) {
      pending.push(value);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const values = pending;
        pending = [];
        timer = undefined;
        flush(values);
      }, delayMs);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      pending = [];
    },
  };
}
