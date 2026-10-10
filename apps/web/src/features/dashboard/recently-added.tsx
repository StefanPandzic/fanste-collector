'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { useCollection } from '@fanste/collection';

import { ItemCard } from '@/components/items/item-card';
import { ItemCardSkeleton } from '@/components/items/item-card-skeleton';
import { Button } from '@/components/ui/button';
import { toGalleryItem } from '@/features/collection/gallery-items';

import type { Route } from 'next';

/** How many items the "Recently added" row shows. */
export const RECENTLY_ADDED_COUNT = 12;

const CARD_WIDTH = 'w-36 shrink-0 sm:w-40';

/** The last items added, newest first, as a horizontally scrolling row of cards. */
export function RecentlyAdded() {
  const recent = useCollection({ sort: 'added_desc', pageSize: RECENTLY_ADDED_COUNT });
  const items = useMemo(() => recent.data?.items.map(toGalleryItem) ?? [], [recent.data]);

  return (
    <section aria-labelledby="recently-added" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="recently-added" className="text-heading">
          Recently added
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/collection">View all</Link>
        </Button>
      </div>
      {recent.isError && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Recently added items couldn&apos;t be loaded.
        </p>
      ) : (
        <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {recent.isPending
            ? Array.from({ length: 6 }, (_, index) => (
                <li key={index} className={CARD_WIDTH}>
                  <ItemCardSkeleton />
                </li>
              ))
            : items.map((item, index) => (
                <li key={item.id} className={CARD_WIDTH}>
                  <ItemCard
                    item={item.card}
                    href={`/collection/${item.id}` as Route}
                    sizes="160px"
                    priority={index < 4}
                  />
                </li>
              ))}
        </ul>
      )}
    </section>
  );
}
