import { customImagePathOf } from '@fanste/core';

import { clientEnv } from '@/env/client';

/**
 * Whether `url` is an upload in this project's `custom-images` bucket (FC-13). Only those load
 * through the image optimizer (`next.config.ts` allows exactly that path); other user-entered URLs
 * load directly, so `remotePatterns` never has to allow arbitrary hosts.
 */
export function isUploadedImageUrl(url: string | null | undefined): boolean {
  const supabaseUrl = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !supabaseUrl) return false;
  return customImagePathOf(url, supabaseUrl) !== undefined;
}

/** Whether a user-entered cover must load without the optimizer (see `isUploadedImageUrl`). */
export function needsUnoptimized(url: string | null | undefined): boolean {
  return Boolean(url) && !isUploadedImageUrl(url);
}

/**
 * Whether an item's cover was entered by the user (a cover override, or a hand-entered item's photo)
 * and must load without the optimizer. Provider covers always go through it.
 */
export function coverNeedsUnoptimized(item: {
  provider: string;
  metadataOverrides: { imageUrl?: string };
  customData: { imageUrl?: string } | null;
}): boolean {
  const userCover =
    item.metadataOverrides.imageUrl ??
    (item.provider === 'custom' ? item.customData?.imageUrl : undefined);
  return needsUnoptimized(userCover);
}
