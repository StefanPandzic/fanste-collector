import { describe, expect, it } from 'vitest';

import {
  customImagePathOf,
  fitWithin,
  isOwnCustomImagePath,
  validateCustomImageFile,
} from './custom-images';

const supabaseUrl = 'https://abcdefgh.supabase.co';
const userId = '5d7e8f90-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const uploadPath = `${userId}/0f8e7d6c-5b4a-4321-9876-543210fedcba.webp`;

describe('validateCustomImageFile', () => {
  it('accepts images and rejects other files and huge images', () => {
    expect(validateCustomImageFile({ type: 'image/jpeg', size: 3_000_000 })).toBeUndefined();
    expect(validateCustomImageFile({ type: 'application/pdf', size: 1000 })).toBe(
      'Pick an image file.',
    );
    expect(validateCustomImageFile({ type: 'image/png', size: 30 * 1024 * 1024 })).toContain(
      '20 MB',
    );
  });
});

describe('fitWithin', () => {
  it('scales the longest side down to 1200 pixels', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(1500, 3000)).toEqual({ width: 600, height: 1200 });
  });

  it('never scales a small image up', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('customImagePathOf', () => {
  it('returns the path of a public custom-images URL of the project', () => {
    expect(
      customImagePathOf(
        `${supabaseUrl}/storage/v1/object/public/custom-images/${uploadPath}`,
        supabaseUrl,
      ),
    ).toBe(uploadPath);
  });

  it('returns undefined for a URL with a malformed escape instead of throwing', () => {
    expect(
      customImagePathOf(
        `${supabaseUrl}/storage/v1/object/public/custom-images/%E0%A4%A`,
        supabaseUrl,
      ),
    ).toBeUndefined();
  });

  it('returns undefined for pasted and other projects URLs', () => {
    expect(
      customImagePathOf('https://images.funko.com/pop/spider-man.png', supabaseUrl),
    ).toBeUndefined();
    expect(
      customImagePathOf(
        `https://other.supabase.co/storage/v1/object/public/custom-images/${uploadPath}`,
        supabaseUrl,
      ),
    ).toBeUndefined();
  });
});

describe('isOwnCustomImagePath', () => {
  it('accepts an upload in the user folder only', () => {
    expect(isOwnCustomImagePath(uploadPath, userId)).toBe(true);
    expect(isOwnCustomImagePath(uploadPath, '11111111-2222-4333-8444-555555555555')).toBe(false);
    expect(isOwnCustomImagePath(`${userId}/cover.png`, userId)).toBe(false);
  });
});
