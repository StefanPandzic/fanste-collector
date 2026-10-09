import { CATEGORY_META } from '@fanste/core';

import type { CategoryAccent, ItemCategory } from '@fanste/core';

// The light-mode `--category-*` accents as hex. A data URL can't read CSS variables; the tint is
// faint enough to work on both themes.
const PLACEHOLDER_COLORS: Record<CategoryAccent, string> = {
  movie: '#c9222b',
  tv: '#7544cd',
  music: '#a05b11',
  'video-game': '#0a7e3a',
  'board-game': '#006eb8',
  funko: '#b82989',
};

function placeholderSvg(color: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3" viewBox="0 0 2 3">' +
    '<linearGradient id="g" x2="1" y2="1">' +
    `<stop stop-color="${color}" stop-opacity=".45"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity=".15"/>` +
    '</linearGradient><rect width="2" height="3" fill="url(#g)"/></svg>'
  );
}

/**
 * A tiny tinted gradient for `next/image`'s `blurDataURL`. Provider covers are remote, so Next.js
 * can't generate a blurred preview for them; this shows the category's color while they load.
 */
export function coverBlurDataUrl(category: ItemCategory): string {
  const svg = placeholderSvg(PLACEHOLDER_COLORS[CATEGORY_META[category].accent]);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
