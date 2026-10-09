'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import {
  GRID_GAP,
  gridColumns,
  gridRowCount,
  gridRowHeight,
  gridRowRange,
  nextGridIndex,
  STICKY_HEADER_OFFSET,
} from './grid-layout';
import { ItemGridSkeleton } from './item-card-skeleton';

interface ItemGridProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  /** Usually an `ItemCard`. Give it an `href` or `onSelect` so the arrow keys can move between cards. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Accessible name of the list, e.g. `Your collection`. */
  label: string;
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Responsive cover grid that renders only the rows near the viewport, so collections with
 * thousands of items scroll smoothly. It scrolls with the page. Arrow keys, Home and End move focus
 * between the cards' links or buttons.
 */
export function ItemGrid<T>({ items, getKey, renderItem, label, className }: ItemGridProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      setWidth(list.clientWidth);
      // The grid's distance from the top of the page, which the window virtualizer offsets by.
      setScrollMargin(list.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    // Content above the grid (filters, banners) can move it without resizing it; that resizes the body.
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const columns = gridColumns(width);
  const virtualizer = useWindowVirtualizer({
    count: width > 0 ? gridRowCount(items.length, columns) : 0,
    estimateSize: () => gridRowHeight(width, columns),
    gap: GRID_GAP,
    overscan: 3,
    scrollMargin,
    // Keeps rows scrolled to with the keyboard clear of the app shell's sticky top bar.
    scrollPaddingStart: STICKY_HEADER_OFFSET,
  });

  function focusItem(index: number, attempts = 10) {
    const card = listRef.current?.querySelector<HTMLElement>(`[data-grid-index="${index}"]`);
    const target = card?.querySelector<HTMLElement>(FOCUSABLE);
    if (target) {
      target.focus({ preventScroll: true });
      // The card's `scroll-mt-18` (`STICKY_HEADER_OFFSET`) keeps it out from under the top bar.
      card?.scrollIntoView({ block: 'nearest' });
    } else if (attempts > 0) {
      // The row may not be rendered yet after scrolling to it.
      requestAnimationFrame(() => focusItem(index, attempts - 1));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-grid-index]');
    if (!card) return;
    const next = nextGridIndex(Number(card.dataset.gridIndex), event.key, columns, items.length);
    if (next === null) return;
    event.preventDefault();
    virtualizer.scrollToIndex(Math.floor(next / columns));
    focusItem(next);
  }

  return (
    <div className={className}>
      {width === 0 && items.length > 0 && <ItemGridSkeleton count={Math.min(items.length, 12)} />}
      <div
        ref={listRef}
        role="list"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const [start, end] = gridRowRange(row.index, columns, items.length);
          return (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={row.index}
              className="absolute inset-x-0 top-0 grid gap-4"
              style={{
                transform: `translateY(${row.start - scrollMargin}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {items.slice(start, end).map((item, offset) => {
                const index = start + offset;
                return (
                  <div
                    key={getKey(item)}
                    role="listitem"
                    className="scroll-mt-18 scroll-mb-4"
                    data-grid-index={index}
                    aria-posinset={index + 1}
                    aria-setsize={items.length}
                  >
                    {renderItem(item, index)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
