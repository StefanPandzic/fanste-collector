'use client';

import { cn } from 'cn';
import Image from 'next/image';
import { useState } from 'react';

import { CATEGORY_META } from '@fanste/core';

import { CategoryIcon } from './category-icon';
import { categoryClasses } from './category-style';
import { coverBlurDataUrl } from './cover-placeholder';

import type { ItemCategory } from '@fanste/core';

interface CoverImageProps {
  /**
   * Cover URL; its host must be in `images.remotePatterns` unless `unoptimized`. Missing → category
   * artwork.
   */
  src?: string | null;
  /** The item's title, read out for the image and the fallback artwork alike. */
  alt: string;
  category: ItemCategory;
  /** `next/image` `sizes`: the rendered width at each breakpoint. */
  sizes: string;
  priority?: boolean;
  /**
   * Loads `src` directly instead of through the image optimizer. Use it for user-entered covers
   * (overrides): their hosts aren't in `remotePatterns`, which must never be widened to `**` (an
   * open fetch proxy).
   */
  unoptimized?: boolean;
  className?: string;
}

/**
 * Cover art in a 2:3 frame. Shows a tinted blur while loading and the category's artwork when there
 * is no cover or it fails to load. Square art (albums, board games, Funko boxes) is fitted, not
 * cropped.
 */
export function CoverImage({
  src,
  alt,
  category,
  sizes,
  priority,
  unoptimized,
  className,
}: CoverImageProps) {
  // Remembers which URL failed, so a new `src` gets a fresh attempt without an effect.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && src !== failedSrc;
  const square = CATEGORY_META[category].coverShape === 'square';

  return (
    <div
      className={cn('relative aspect-cover w-full overflow-hidden rounded-lg bg-muted', className)}
    >
      {showImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={unoptimized}
          placeholder="blur"
          blurDataURL={coverBlurDataUrl(category)}
          onError={() => setFailedSrc(src)}
          className={square ? 'object-contain' : 'object-cover'}
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-linear-to-br',
            categoryClasses(category).fallback,
          )}
        >
          <CategoryIcon category={category} className="size-1/3 max-w-16 opacity-80" />
        </div>
      )}
    </div>
  );
}
