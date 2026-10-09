import type { AVATAR_MIME_TYPES } from '@fanste/core';

/** Storage bucket for avatars (migration `avatars_bucket`). Objects live under `<user id>/`. */
export const AVATAR_BUCKET = 'avatars';

const EXTENSIONS: Record<(typeof AVATAR_MIME_TYPES)[number], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** A new, unique object path for an avatar upload, e.g. `<user id>/<uuid>.png`. */
export function newAvatarPath(userId: string, mimeType: string): string {
  const extension = EXTENSIONS[mimeType as keyof typeof EXTENSIONS] ?? 'img';
  return `${userId}/${crypto.randomUUID()}.${extension}`;
}

const AVATAR_FILE = /^[0-9a-f-]{36}\.(?:png|jpg|webp)$/;

/** `true` if `path` is an avatar object path that {@link newAvatarPath} made for `userId`. */
export function isOwnAvatarPath(path: string, userId: string): boolean {
  const [folder, file, ...rest] = path.split('/');
  return folder === userId && file !== undefined && rest.length === 0 && AVATAR_FILE.test(file);
}
