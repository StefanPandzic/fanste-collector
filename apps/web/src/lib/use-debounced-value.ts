'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * `value`, updated only after it has stopped changing for `delayMs`. The returned `flush` sets the
 * debounced value at once (e.g. when the user presses Enter).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): [T, (next: T) => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  const flush = useCallback((next: T) => setDebounced(next), []);
  return [debounced, flush];
}
