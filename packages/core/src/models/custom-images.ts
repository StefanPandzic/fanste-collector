// Photos of hand-entered items and uploaded covers (FC-13), in the public `custom-images` Storage
// bucket. Objects are named `<user id>/<uuid>.webp`, and items store their full public URL. The free
// tier has 1 GB of Storage, so images are scaled down and compressed to WebP on the client first.

/** The Storage bucket (migration `custom_collections`). */
export const CUSTOM_IMAGES_BUCKET = 'custom-images';
/** Same limit as the bucket's `file_size_limit`. */
export const CUSTOM_IMAGE_MAX_BYTES = 1024 * 1024;
/** Same list as the bucket's `allowed_mime_types`. */
export const CUSTOM_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** Longest side of a stored image, in pixels. */
export const CUSTOM_IMAGE_MAX_DIMENSION = 1200;
/** Largest file a user can pick; it is compressed below `CUSTOM_IMAGE_MAX_BYTES` before upload. */
export const CUSTOM_IMAGE_MAX_INPUT_BYTES = 20 * 1024 * 1024;

/** A user-facing problem with a picked file, or `undefined` if it can be compressed and uploaded. */
export function validateCustomImageFile(file: { type: string; size: number }): string | undefined {
  if (!file.type.startsWith('image/')) return 'Pick an image file.';
  if (file.size > CUSTOM_IMAGE_MAX_INPUT_BYTES) return 'Use an image of at most 20 MB.';
  return undefined;
}

/**
 * The size an image is scaled to so its longest side is at most `max` pixels, keeping its aspect
 * ratio. Smaller images keep their size (they are never scaled up).
 */
export function fitWithin(
  width: number,
  height: number,
  max = CUSTOM_IMAGE_MAX_DIMENSION,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** A new, unique object path for an upload of `userId`, e.g. `<user id>/<uuid>.webp`. */
export function newCustomImagePath(userId: string): string {
  return `${userId}/${crypto.randomUUID()}.webp`;
}

const PUBLIC_PREFIX = `/storage/v1/object/public/${CUSTOM_IMAGES_BUCKET}/`;

/**
 * The object path of `url` if it is a public URL of the `custom-images` bucket of the Supabase
 * project at `supabaseUrl`, else `undefined` (a pasted URL, or another project's).
 */
export function customImagePathOf(url: string, supabaseUrl: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(supabaseUrl).origin) return undefined;
    if (!parsed.pathname.startsWith(PUBLIC_PREFIX)) return undefined;
    const path = decodeURIComponent(parsed.pathname.slice(PUBLIC_PREFIX.length));
    return path.length > 0 ? path : undefined;
  } catch {
    // Not a URL, or a malformed escape (`%E0%A4%A`): a pasted address, never an upload.
    return undefined;
  }
}

/** Whether `path` is an object of `userId`'s folder that `newCustomImagePath` could have made. */
export function isOwnCustomImagePath(path: string, userId: string): boolean {
  const [folder, file, ...rest] = path.split('/');
  return (
    folder === userId &&
    file !== undefined &&
    rest.length === 0 &&
    /^[0-9a-f-]{36}\.webp$/.test(file)
  );
}
