import { describe, expect, it, vi } from 'vitest';

import { coverNeedsUnoptimized, isUploadedImageUrl } from './custom-images';

vi.mock('../env/client', () => ({
  clientEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefgh.supabase.co' },
}));

const uploadUrl =
  'https://abcdefgh.supabase.co/storage/v1/object/public/custom-images/5d7e8f90-1a2b-4c3d-8e9f-0a1b2c3d4e5f/0f8e7d6c-5b4a-4321-9876-543210fedcba.webp';
const pastedUrl = 'https://images.funko.com/pop/spider-man.png';

describe('isUploadedImageUrl', () => {
  it('accepts only uploads of this project', () => {
    expect(isUploadedImageUrl(uploadUrl)).toBe(true);
    expect(isUploadedImageUrl(pastedUrl)).toBe(false);
    expect(isUploadedImageUrl(uploadUrl.replace('abcdefgh', 'otherproj'))).toBe(false);
  });
});

describe('coverNeedsUnoptimized', () => {
  it('leaves pasted covers unoptimized and optimizes uploads', () => {
    expect(
      coverNeedsUnoptimized({
        provider: 'custom',
        metadataOverrides: {},
        customData: { imageUrl: pastedUrl },
      }),
    ).toBe(true);
    expect(
      coverNeedsUnoptimized({
        provider: 'custom',
        metadataOverrides: {},
        customData: { imageUrl: uploadUrl },
      }),
    ).toBe(false);
    expect(
      coverNeedsUnoptimized({
        provider: 'tmdb',
        metadataOverrides: { imageUrl: pastedUrl },
        customData: null,
      }),
    ).toBe(true);
  });

  it('optimizes provider covers', () => {
    expect(
      coverNeedsUnoptimized({ provider: 'tmdb', metadataOverrides: {}, customData: null }),
    ).toBe(false);
  });
});
