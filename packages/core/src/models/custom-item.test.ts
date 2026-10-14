import { describe, expect, it } from 'vitest';

import {
  customItemDataSchema,
  customItemSubtitle,
  customItemToNormalized,
  parseCustomItemData,
} from './custom-item';

const spiderManPop = {
  title: 'Spider-Man',
  subtitle: 'Marvel',
  identifier: '#123',
  releaseYear: 2017,
  creators: ['Funko'],
  imageUrl: 'https://example.supabase.co/storage/v1/object/public/custom-images/u/pop.webp',
};

describe('customItemDataSchema', () => {
  it('accepts an item and removes duplicate creators', () => {
    expect(customItemDataSchema.parse({ ...spiderManPop, creators: ['Funko', 'Funko'] })).toEqual(
      spiderManPop,
    );
  });

  it('rejects a missing title and non-https images', () => {
    expect(customItemDataSchema.safeParse({ subtitle: 'Marvel' }).success).toBe(false);
    expect(
      customItemDataSchema.safeParse({ title: 'Spider-Man', imageUrl: 'http://example.com/a.png' })
        .success,
    ).toBe(false);
  });
});

describe('parseCustomItemData', () => {
  it('keeps the valid fields and drops the invalid ones', () => {
    expect(parseCustomItemData({ title: 'Millennium Falcon', releaseYear: 'soon' })).toEqual({
      title: 'Millennium Falcon',
    });
  });

  it('returns null without a title', () => {
    expect(parseCustomItemData({ subtitle: 'Star Wars' })).toBeNull();
  });
});

describe('customItemSubtitle', () => {
  it('joins the identifier and the subtitle', () => {
    expect(customItemSubtitle({ identifier: '#123', subtitle: 'Marvel' })).toBe('#123 · Marvel');
    expect(customItemSubtitle({ subtitle: 'Star Wars' })).toBe('Star Wars');
    expect(customItemSubtitle({})).toBeUndefined();
  });
});

describe('customItemToNormalized', () => {
  it('maps a hand-entered item to a custom normalized item', () => {
    expect(
      customItemToNormalized({
        id: 'b2f1c6c0-3e8a-4f7e-9d7a-0c1f2e3d4a5b',
        category: 'custom',
        customData: spiderManPop,
      }),
    ).toEqual({
      provider: 'custom',
      externalId: 'b2f1c6c0-3e8a-4f7e-9d7a-0c1f2e3d4a5b',
      category: 'custom',
      title: 'Spider-Man',
      subtitle: '#123 · Marvel',
      releaseYear: 2017,
      imageUrl: spiderManPop.imageUrl,
      thumbnailUrl: spiderManPop.imageUrl,
      creators: ['Funko'],
    });
  });
});
