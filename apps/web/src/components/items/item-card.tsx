import { cn } from 'cn';
import Link from 'next/link';

import { CategoryBadge } from './category-badge';
import { CoverImage } from './cover-image';
import { OwnershipBadge } from './ownership-badge';

import type { ItemCategory, OwnershipStatus } from '@fanste/core';
import type { Route } from 'next';
import type { ReactNode } from 'react';

/**
 * What a card shows. A `NormalizedItem` (search results) fits as is; a collection item adds its
 * `ownership`.
 */
export interface ItemCardData {
  title: string;
  category: ItemCategory;
  releaseYear?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  ownership?: OwnershipStatus;
  /** The cover is a user-entered URL: load it without the image optimizer (see `CoverImage`). */
  coverUnoptimized?: boolean;
  /**
   * Key copy details as small badges, e.g. `["4K UHD", "Dolby Vision"]` (`copyBadges`). When set,
   * the card always has a badge line, so cards in a grid keep the same height (`CARD_BADGES_HEIGHT`).
   */
  badges?: readonly string[];
}

interface ItemCardProps {
  item: ItemCardData;
  /** Makes the whole card a link. */
  href?: Route;
  /** Makes the whole card a button (e.g. to open a detail dialog). Ignored when `href` is set. */
  onSelect?: () => void;
  /** Overlay in the cover's top-right corner, e.g. an "In collection" badge. */
  badge?: ReactNode;
  /**
   * Overlay in the cover's bottom-right corner, e.g. a quick-add button. It sits above the card's
   * link or button, so it stays clickable on its own.
   */
  action?: ReactNode;
  /** Rendered width of the card, for the cover's `sizes`. */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

const DEFAULT_SIZES = '(max-width: 639px) 50vw, 240px';

/** Cover, title, year, category and ownership of one item. */
export function ItemCard({
  item,
  href,
  onSelect,
  badge,
  action,
  sizes,
  priority,
  className,
}: ItemCardProps) {
  const interactive = href !== undefined || onSelect !== undefined;
  // The title is the link/button; `after:` stretches its hit area over the whole card.
  const stretched = 'outline-none after:absolute after:inset-0 after:rounded-xl';

  return (
    <article
      className={cn(
        'group/card relative flex flex-col gap-2 rounded-xl bg-card p-1.5 pb-card text-card-foreground shadow-card transition-shadow',
        interactive &&
          'hover:shadow-card-hover has-focus-visible:ring-3 has-focus-visible:ring-ring/60',
        className,
      )}
    >
      <div className="relative">
        <CoverImage
          src={item.thumbnailUrl ?? item.imageUrl}
          alt={item.title}
          category={item.category}
          sizes={sizes ?? DEFAULT_SIZES}
          priority={priority}
          unoptimized={item.coverUnoptimized}
        />
        {item.ownership && (
          <OwnershipBadge
            status={item.ownership}
            variant="overlay"
            className="absolute top-2 left-2"
          />
        )}
        {badge && <div className="absolute top-2 right-2 z-10">{badge}</div>}
        {action && <div className="absolute right-2 bottom-2 z-10">{action}</div>}
      </div>

      <div className="flex min-w-0 flex-col gap-1 px-1.5">
        <h3 className="truncate text-sm font-medium" title={item.title}>
          {href ? (
            <Link href={href} className={stretched}>
              {item.title}
            </Link>
          ) : onSelect ? (
            <button type="button" onClick={onSelect} className={cn(stretched, 'text-left')}>
              {item.title}
            </button>
          ) : (
            item.title
          )}
        </h3>
        <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
          {item.releaseYear !== undefined && <span>{item.releaseYear}</span>}
          <CategoryBadge category={item.category} iconOnly className="ml-auto" />
        </div>
        {item.badges && (
          <ul
            aria-label="Copy details"
            className="flex h-4.5 min-w-0 gap-1 overflow-hidden text-[0.6875rem] leading-4.5 text-muted-foreground"
          >
            {item.badges.map((label, index) => (
              <li
                key={`${index}-${label}`}
                className="shrink-0 rounded-sm bg-muted px-1 whitespace-nowrap"
              >
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
