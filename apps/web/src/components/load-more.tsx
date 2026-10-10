'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

interface LoadMoreProps {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onLoadMore: () => void;
}

/**
 * Loads the next page when the user scrolls near the end of the list. The button does the same,
 * for keyboard users and when the observer can't fire (e.g. after a failed page).
 */
export function LoadMore({ hasMore, loading, failed, onLoadMore }: LoadMoreProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  useEffect(() => {
    loadRef.current = onLoadMore;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadRef.current();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, failed]);

  if (!hasMore) return null;
  return (
    <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-4">
      {failed && (
        <p className="text-sm text-destructive" role="alert">
          More could not be loaded.
        </p>
      )}
      <Button variant="outline" onClick={onLoadMore} disabled={loading}>
        {loading && <Loader2 aria-hidden className="animate-spin" />}
        {loading ? 'Loading…' : failed ? 'Try again' : 'Load more'}
      </Button>
    </div>
  );
}
