import { describe, expect, it } from 'vitest';

import { AVATAR_MAX_BYTES, profileSchema, validateAvatarFile } from './profile';

describe('profileSchema', () => {
  it('trims the display name and clears an empty one', () => {
    expect(profileSchema.parse({ displayName: '  Ada Lovelace ', defaultCurrency: 'EUR' })).toEqual(
      {
        displayName: 'Ada Lovelace',
        defaultCurrency: 'EUR',
      },
    );
    expect(profileSchema.parse({ displayName: '   ', defaultCurrency: 'USD' }).displayName).toBe(
      null,
    );
  });

  it('rejects long display names and unknown currencies', () => {
    expect(
      profileSchema.safeParse({ displayName: 'a'.repeat(101), defaultCurrency: 'EUR' }).success,
    ).toBe(false);
    expect(profileSchema.safeParse({ displayName: 'Ada', defaultCurrency: 'XYZ' }).success).toBe(
      false,
    );
  });
});

describe('validateAvatarFile', () => {
  it('accepts a small PNG, JPEG or WebP image', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 120_000 })).toBeUndefined();
    expect(validateAvatarFile({ type: 'image/webp', size: AVATAR_MAX_BYTES })).toBeUndefined();
  });

  it('rejects other file types and files over the size limit', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 1000 })).toBe(
      'Use a PNG, JPEG or WebP image.',
    );
    expect(validateAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES + 1 })).toBe(
      'Use an image of at most 2 MB.',
    );
  });
});
