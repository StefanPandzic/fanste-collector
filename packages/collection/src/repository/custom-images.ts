import {
  CUSTOM_IMAGE_MAX_BYTES,
  CUSTOM_IMAGES_BUCKET,
  customImagePathOf,
  isOwnCustomImagePath,
  newCustomImagePath,
} from '@fanste/core';

import { CollectionError, toCollectionError } from '../errors';

import type { FansteSupabaseClient } from '@fanste/supabase';

// Photos of hand-entered items and uploaded covers (FC-13) in the public `custom-images` bucket.
// Compress the image to WebP first (each app has its own way: canvas on web and desktop); Storage
// RLS only lets a user write into their own `<user id>/` folder.

/** The public URL prefix of the bucket in the client's project, e.g. `https://x.supabase.co/…/`. */
function bucketOrigin(client: FansteSupabaseClient): string {
  return new URL(client.storage.from(CUSTOM_IMAGES_BUCKET).getPublicUrl('x').data.publicUrl).origin;
}

/** Uploads a compressed WebP image of `userId` and returns its public URL. */
export async function uploadCustomImage(
  client: FansteSupabaseClient,
  userId: string,
  image: Blob,
): Promise<string> {
  if (image.size > CUSTOM_IMAGE_MAX_BYTES) {
    throw new CollectionError('invalid', 'The image is too large.');
  }
  const bucket = client.storage.from(CUSTOM_IMAGES_BUCKET);
  const path = newCustomImagePath(userId);
  const { error } = await bucket.upload(path, image, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw toCollectionError(error);
  return bucket.getPublicUrl(path).data.publicUrl;
}

/**
 * Deletes an uploaded image of `userId` by its public URL, e.g. after it was replaced. URLs that
 * aren't the user's uploads (pasted addresses) are ignored. Best effort: failures are swallowed,
 * since an orphaned file only costs storage.
 */
export async function removeCustomImage(
  client: FansteSupabaseClient,
  userId: string,
  url: string | null | undefined,
): Promise<void> {
  if (!url) return;
  const path = customImagePathOf(url, bucketOrigin(client));
  if (!path || !isOwnCustomImagePath(path, userId)) return;
  await client.storage
    .from(CUSTOM_IMAGES_BUCKET)
    .remove([path])
    .catch(() => undefined);
}
