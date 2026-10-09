export interface ThrottleOptions {
  /** Tokens added per second. */
  ratePerSecond: number;
  /** Bucket size: requests that may start at once after a quiet period. */
  burst: number;
  /** Tasks running at the same time. */
  maxConcurrent: number;
  /**
   * Tasks that may wait in the queue. When it's full, `schedule` rejects at once with a
   * `ThrottleFullError`, so one caller can't make everyone else wait for minutes.
   */
  maxQueue?: number;
}

/** Thrown by `Throttle.schedule` when the queue is full. */
export class ThrottleFullError extends Error {
  constructor() {
    super('The request queue is full.');
    this.name = 'ThrottleFullError';
  }
}

export interface Throttle {
  /**
   * Runs `task` once a token and a concurrency slot are free; tasks start in call order. Rejects
   * with a `ThrottleFullError` when the queue is full.
   */
  schedule<T>(task: () => Promise<T>): Promise<T>;
}

interface Pending {
  run: () => void;
}

/** A token-bucket rate limiter with a concurrency cap and a FIFO queue, for outbound requests. */
export function createThrottle({
  ratePerSecond,
  burst,
  maxConcurrent,
  maxQueue = Number.POSITIVE_INFINITY,
}: ThrottleOptions): Throttle {
  const queue: Pending[] = [];
  let tokens = burst;
  let lastRefill = Date.now();
  let active = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function refill() {
    const now = Date.now();
    tokens = Math.min(burst, tokens + ((now - lastRefill) / 1000) * ratePerSecond);
    lastRefill = now;
  }

  function pump() {
    refill();
    while (queue.length > 0 && active < maxConcurrent && tokens >= 1) {
      tokens -= 1;
      active += 1;
      queue.shift()?.run();
    }
    // Out of tokens: wake up when the next one is due. (A free concurrency slot calls `pump` itself.)
    if (queue.length > 0 && active < maxConcurrent && timer === undefined) {
      const waitMs = Math.ceil(((1 - tokens) / ratePerSecond) * 1000);
      timer = setTimeout(() => {
        timer = undefined;
        pump();
      }, waitMs);
    }
  }

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        if (queue.length >= maxQueue) {
          reject(new ThrottleFullError());
          return;
        }
        queue.push({
          run: () => {
            // `.then(task)` turns a synchronous throw into a rejection, so the slot is always freed.
            Promise.resolve()
              .then(task)
              .then(resolve, reject)
              .finally(() => {
                active -= 1;
                pump();
              });
          },
        });
        pump();
      });
    },
  };
}
