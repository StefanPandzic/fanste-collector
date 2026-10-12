import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createThrottle, ThrottleFullError } from './throttle';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createThrottle', () => {
  it('starts a burst at once, then waits for the bucket to refill', async () => {
    const throttle = createThrottle({ ratePerSecond: 2, burst: 2, maxConcurrent: 10 });
    let started = 0;
    const task = () => {
      started += 1;
      return Promise.resolve(started);
    };

    const results = Promise.all([
      throttle.schedule(task),
      throttle.schedule(task),
      throttle.schedule(task),
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toBe(2);

    await vi.advanceTimersByTimeAsync(499);
    expect(started).toBe(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(started).toBe(3);
    expect(await results).toEqual([1, 2, 3]);
  });

  it('runs at most maxConcurrent tasks at once', async () => {
    const throttle = createThrottle({ ratePerSecond: 100, burst: 10, maxConcurrent: 1 });
    const finishers: (() => void)[] = [];
    let running = 0;
    const task = () =>
      new Promise<void>((resolve) => {
        running += 1;
        finishers.push(() => {
          running -= 1;
          resolve();
        });
      });

    const done = Promise.all([throttle.schedule(task), throttle.schedule(task)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(running).toBe(1);

    finishers[0]?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(running).toBe(1);
    expect(finishers).toHaveLength(2);

    finishers[1]?.();
    await done;
    expect(running).toBe(0);
  });

  it('rejects at once when the queue is full', async () => {
    const throttle = createThrottle({
      ratePerSecond: 100,
      burst: 10,
      maxConcurrent: 1,
      maxQueue: 1,
    });
    let finish = () => {};
    const running = throttle.schedule(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const queued = throttle.schedule(() => Promise.resolve());

    await expect(throttle.schedule(() => Promise.resolve())).rejects.toBeInstanceOf(
      ThrottleFullError,
    );

    await vi.advanceTimersByTimeAsync(0);
    finish();
    await Promise.all([running, queued]);
  });
  it('starts no task until a pause ends', async () => {
    const throttle = createThrottle({ ratePerSecond: 100, burst: 10, maxConcurrent: 10 });
    let started = 0;
    throttle.pauseFor(1000);
    const done = throttle.schedule(() => {
      started += 1;
      return Promise.resolve();
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(started).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(started).toBe(1);
    await done;
  });

  it('starts one task at a time after a pause instead of a burst', async () => {
    const throttle = createThrottle({ ratePerSecond: 1, burst: 3, maxConcurrent: 3 });
    let started = 0;
    throttle.pauseFor(5000);
    const tasks = [1, 2, 3].map(() =>
      throttle.schedule(() => {
        started += 1;
        return Promise.resolve();
      }),
    );

    await vi.advanceTimersByTimeAsync(5000);
    expect(started).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(started).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(tasks);
    expect(started).toBe(3);
  });
});
