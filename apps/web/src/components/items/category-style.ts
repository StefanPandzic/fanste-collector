import { CATEGORY_META, OWNERSHIP_META } from '@fanste/core';

import type { CategoryAccent, ItemCategory, OwnershipMeta, OwnershipStatus } from '@fanste/core';

interface AccentClasses {
  /** Tinted background with accent text, for badges. */
  soft: string;
  /** Gradient and icon color of the fallback cover artwork. */
  fallback: string;
}

// Tailwind only generates classes it finds written out in full, so these can't be built from the
// accent name at runtime.
const ACCENT_CLASSES: Record<CategoryAccent, AccentClasses> = {
  movie: {
    soft: 'bg-category-movie/10 text-category-movie',
    fallback: 'from-category-movie/30 to-category-movie/5 text-category-movie',
  },
  tv: {
    soft: 'bg-category-tv/10 text-category-tv',
    fallback: 'from-category-tv/30 to-category-tv/5 text-category-tv',
  },
  music: {
    soft: 'bg-category-music/10 text-category-music',
    fallback: 'from-category-music/30 to-category-music/5 text-category-music',
  },
  'video-game': {
    soft: 'bg-category-video-game/10 text-category-video-game',
    fallback: 'from-category-video-game/30 to-category-video-game/5 text-category-video-game',
  },
  'board-game': {
    soft: 'bg-category-board-game/10 text-category-board-game',
    fallback: 'from-category-board-game/30 to-category-board-game/5 text-category-board-game',
  },
  funko: {
    soft: 'bg-category-funko/10 text-category-funko',
    fallback: 'from-category-funko/30 to-category-funko/5 text-category-funko',
  },
};

export function categoryClasses(category: ItemCategory): AccentClasses {
  return ACCENT_CLASSES[CATEGORY_META[category].accent];
}

interface ToneClasses {
  /** Tinted background with tone-colored text. */
  soft: string;
  /** The status dot. */
  dot: string;
}

const TONE_CLASSES: Record<OwnershipMeta['tone'], ToneClasses> = {
  success: { soft: 'bg-success/10 text-success', dot: 'bg-success' },
  info: { soft: 'bg-info/10 text-info', dot: 'bg-info' },
  warning: { soft: 'bg-warning/10 text-warning', dot: 'bg-warning' },
  neutral: { soft: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export function ownershipClasses(status: OwnershipStatus): ToneClasses {
  return TONE_CLASSES[OWNERSHIP_META[status].tone];
}
