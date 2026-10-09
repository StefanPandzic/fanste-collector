// Layout math for `ItemGrid`. Kept free of React so it can be unit-tested.

/** Space between cards, in px (`gap-4`). */
export const GRID_GAP = 16;
/** Narrowest a card may get, in px: two columns still fit in a 320px-wide window. */
export const MIN_CARD_WIDTH = 140;
/** More columns than this only makes the covers huge on very wide screens. */
export const MAX_GRID_COLUMNS = 12;
/** Cover height / width (the `aspect-cover` 2:3 frame). */
export const COVER_HEIGHT_RATIO = 3 / 2;
/** Horizontal padding around a card's cover, in px (`p-1.5` on both sides). */
export const CARD_INSET = 12;
/** Height of a card without its cover (padding, title, meta row), in px. Matches `ItemCard`. */
export const CARD_CAPTION_HEIGHT = 70;
/**
 * Space to keep above a card scrolled into view: the sticky top bar plus a gap. Keep in sync with
 * the app shell's `h-14` header (and `TITLE_BAR_HEIGHT` in the desktop app).
 */
export const STICKY_HEADER_OFFSET = 56 + GRID_GAP;

/** Number of columns that fit in a container `width` px wide (at least 1). */
export function gridColumns(width: number): number {
  const fit = Math.floor((width + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP));
  return Math.min(MAX_GRID_COLUMNS, Math.max(1, fit));
}

/** Estimated height of one grid row, in px, without the gap below it. */
export function gridRowHeight(width: number, columns: number): number {
  const cardWidth = Math.max(0, (width - GRID_GAP * (columns - 1)) / columns);
  return Math.round(Math.max(0, cardWidth - CARD_INSET) * COVER_HEIGHT_RATIO + CARD_CAPTION_HEIGHT);
}

export function gridRowCount(itemCount: number, columns: number): number {
  return Math.ceil(itemCount / columns);
}

/** Item indexes `[start, end)` in row `row`. */
export function gridRowRange(row: number, columns: number, itemCount: number): [number, number] {
  const start = row * columns;
  return [start, Math.min(start + columns, itemCount)];
}

/**
 * The item index that a navigation key moves focus to, or `null` when the key isn't a grid key or
 * there is nothing in that direction. Arrow Down from the second-to-last row lands on the last item
 * when the last row is shorter.
 */
export function nextGridIndex(
  index: number,
  key: string,
  columns: number,
  itemCount: number,
): number | null {
  const last = itemCount - 1;
  let next: number;
  switch (key) {
    case 'ArrowRight':
      next = index + 1;
      break;
    case 'ArrowLeft':
      next = index - 1;
      break;
    case 'ArrowDown':
      next = index + columns;
      if (next > last && Math.floor(index / columns) < Math.floor(last / columns)) next = last;
      break;
    case 'ArrowUp':
      next = index - columns;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = last;
      break;
    default:
      return null;
  }
  return next >= 0 && next <= last && next !== index ? next : null;
}
