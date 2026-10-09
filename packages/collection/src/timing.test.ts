import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBatcher, metadataRetryDelay, reconnectDelay } from './timing';

describe('reconnectDelay', () => {
  it('doubles the delay per attempt up to 30 seconds', () => {
    expect(reconnectDelay(0)).toBe(1000);
    expect(reconnectDelay(1)).toBe(2000);
    expect(reconnectDelay(3)).toBe(8000);
    expect(reconnectDelay(10)).toBe(30_000);
  });
});

describe('metadataRetryDelay', () => {
  it('backs off and stops after the last attempt', () => {
    expect(metadataRetryDelay(0)).toBe(2000);
    expect(metadataRetryDelay(2)).toBe(8000);
    expect(metadataRetryDelay(5)).toBe(false);
    expect(metadataRetryDelay(2, 2)).toBe(false);
  });
});

describe('createBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes a burst of values once it goes quiet', () => {
    const flush = vi.fn();
    const batcher = createBatcher<string>(200, flush);
    batcher.push('movie:603');
    vi.advanceTimersByTime(150);
    batcher.push('movie:604');
    vi.advanceTimersByTime(150);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(['movie:603', 'movie:604']);
  });

  it('drops pending values on cancel', () => {
    const flush = vi.fn();
    const batcher = createBatcher<string>(200, flush);
    batcher.push('movie:603');
    batcher.cancel();
    vi.advanceTimersByTime(500);
    expect(flush).not.toHaveBeenCalled();
  });
});
