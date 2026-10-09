import type { ItemCategory, OwnershipStatus } from './enums';

/**
 * Icon names from the Lucide set (https://lucide.dev). Core stays free of React, so each app maps
 * the name to its own component (`lucide-react` on web, `lucide-react-native` on mobile).
 */
export type CategoryIconName = 'film' | 'tv' | 'disc-3' | 'gamepad-2' | 'dices' | 'toy-brick';

/**
 * Suffix of the category's color tokens in the shared Tailwind theme (`--category-<accent>`,
 * `bg-category-<accent>`). Kebab-case, because the CSS names are.
 */
export type CategoryAccent = 'movie' | 'tv' | 'music' | 'video-game' | 'board-game' | 'funko';

export interface CategoryMeta {
  /** Singular, e.g. `Video Game`. */
  readonly label: string;
  /** Plural, e.g. `Video Games`. */
  readonly pluralLabel: string;
  readonly icon: CategoryIconName;
  readonly accent: CategoryAccent;
  /** Shape of the usual cover art: posters and box art are portrait, album covers square. */
  readonly coverShape: 'portrait' | 'square';
}

/** Display metadata for every item category. */
export const CATEGORY_META = {
  movie: {
    label: 'Movie',
    pluralLabel: 'Movies',
    icon: 'film',
    accent: 'movie',
    coverShape: 'portrait',
  },
  tv: {
    label: 'TV Show',
    pluralLabel: 'TV Shows',
    icon: 'tv',
    accent: 'tv',
    coverShape: 'portrait',
  },
  music: {
    label: 'Music',
    pluralLabel: 'Music',
    icon: 'disc-3',
    accent: 'music',
    coverShape: 'square',
  },
  video_game: {
    label: 'Video Game',
    pluralLabel: 'Video Games',
    icon: 'gamepad-2',
    accent: 'video-game',
    coverShape: 'portrait',
  },
  board_game: {
    label: 'Board Game',
    pluralLabel: 'Board Games',
    icon: 'dices',
    accent: 'board-game',
    coverShape: 'square',
  },
  funko: {
    label: 'Funko Pop',
    pluralLabel: 'Funko Pops',
    icon: 'toy-brick',
    accent: 'funko',
    coverShape: 'square',
  },
} as const satisfies Record<ItemCategory, CategoryMeta>;

/**
 * How an ownership status is shown. `tone` maps to the theme's status colors (`success`,
 * `warning`, `info`) or to the muted color for `neutral`.
 */
export interface OwnershipMeta {
  readonly label: string;
  readonly tone: 'success' | 'warning' | 'info' | 'neutral';
}

export const OWNERSHIP_META = {
  owned: { label: 'Owned', tone: 'success' },
  wishlist: { label: 'Wishlist', tone: 'info' },
  preordered: { label: 'Pre-ordered', tone: 'warning' },
  loaned_out: { label: 'Loaned out', tone: 'warning' },
  sold: { label: 'Sold', tone: 'neutral' },
} as const satisfies Record<OwnershipStatus, OwnershipMeta>;

/** `Movie`, `Video Game`, ...; `plural` gives `Movies`, `Video Games`, ... */
export function categoryLabel(category: ItemCategory, { plural = false } = {}): string {
  const meta = CATEGORY_META[category];
  return plural ? meta.pluralLabel : meta.label;
}

export function ownershipLabel(status: OwnershipStatus): string {
  return OWNERSHIP_META[status].label;
}
