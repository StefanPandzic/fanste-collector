import { z } from 'zod';

/** Currencies offered for prices and values (ISO 4217). The database accepts any 3-letter code. */
export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'JPY',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'CZK',
  'HUF',
  'RSD',
] as const;

export type Currency = (typeof CURRENCIES)[number];

/** Same limit as the `profiles_display_name_length` check constraint. */
export const DISPLAY_NAME_MAX_LENGTH = 100;

/** Editable profile fields (settings page). An empty display name clears it. */
export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(DISPLAY_NAME_MAX_LENGTH, { error: `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters.` })
    .transform((value) => value || null),
  defaultCurrency: z.enum(CURRENCIES, { error: 'Choose a currency from the list.' }),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type Profile = z.output<typeof profileSchema>;

/** Avatar uploads: must match the `avatars` Storage bucket limits (migration `avatars_bucket`). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Returns an error message if `file` can't be used as an avatar, otherwise `undefined`. */
export function validateAvatarFile(file: { type: string; size: number }): string | undefined {
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a PNG, JPEG or WebP image.';
  }
  if (file.size > AVATAR_MAX_BYTES) return 'Use an image of at most 2 MB.';
  return undefined;
}
