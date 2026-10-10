import { describe, expect, it } from 'vitest';

import { galleryViewKey, loadGalleryView } from './view-mode';

const userId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

function storageWith(values: Record<string, string>): Storage {
  return { getItem: (key: string) => values[key] ?? null } as Storage;
}

describe('galleryViewKey', () => {
  it('scopes the key to the user', () => {
    expect(galleryViewKey(userId)).toBe(`fanste:collection-view:${userId}`);
  });
});

describe('loadGalleryView', () => {
  it('returns the stored view', () => {
    const key = galleryViewKey(userId);
    expect(loadGalleryView(storageWith({ [key]: 'list' }), key)).toBe('list');
  });

  it('falls back to the grid without a valid stored view', () => {
    const key = galleryViewKey(userId);
    expect(loadGalleryView(storageWith({ [key]: 'table' }), key)).toBe('grid');
    expect(loadGalleryView(undefined, key)).toBe('grid');
  });
});
