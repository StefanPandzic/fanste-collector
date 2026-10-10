import { describe, expect, it } from 'vitest';

import { formatDate, formatMoney, LOADING_TITLE, toGalleryItem } from './gallery-items';

import type { CollectionItem } from '@fanste/core';

const inception: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
  format: '4K UHD Blu-ray',
  details: { edition: 'Steelbook' },
  metadataOverrides: {},
  ownership: 'owned',
  quantity: 1,
  acquiredAt: '2024-05-01',
  purchasePrice: null,
  estimatedValue: 24.99,
  currency: 'EUR',
  notes: null,
  source: 'search',
  createdAt: '2026-09-25T14:02:32.123456+00:00',
  updatedAt: '2026-09-25T14:02:32.123456+00:00',
  tagIds: [],
  metadata: {
    provider: 'tmdb',
    externalId: 'movie:27205',
    category: 'movie',
    title: 'Inception',
    subtitle: 'Christopher Nolan',
    releaseYear: 2010,
    imageUrl: 'https://image.tmdb.org/t/p/original/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    thumbnailUrl: 'https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
  },
};

const customCover = 'https://example.com/covers/inception-steelbook.jpg';

describe('toGalleryItem', () => {
  it('shows the provider metadata with the copy badges', () => {
    const item = toGalleryItem(inception);
    expect(item.card).toEqual({
      title: 'Inception',
      category: 'movie',
      releaseYear: 2010,
      imageUrl: inception.metadata?.imageUrl,
      thumbnailUrl: inception.metadata?.thumbnailUrl,
      ownership: 'owned',
      coverUnoptimized: false,
      badges: ['4K UHD', 'Steelbook'],
    });
    expect(item.subtitle).toBe('Christopher Nolan');
    expect(item.estimatedValue).toBe(24.99);
  });

  it('applies the overrides and leaves a custom cover unoptimized', () => {
    const item = toGalleryItem({
      ...inception,
      metadataOverrides: { title: 'Inception (Steelbook)', imageUrl: customCover },
    });
    expect(item.card.title).toBe('Inception (Steelbook)');
    expect(item.card.imageUrl).toBe(customCover);
    expect(item.card.thumbnailUrl).toBe(customCover);
    expect(item.card.coverUnoptimized).toBe(true);
  });

  it('shows the loading title until the metadata arrives', () => {
    expect(toGalleryItem({ ...inception, metadata: null }).card.title).toBe(LOADING_TITLE);
  });
});

describe('formatMoney', () => {
  it('formats an amount with or without a currency', () => {
    expect(formatMoney(12.5, 'USD', 'en-US')).toBe('$12.50');
    expect(formatMoney(1234.5, null, 'en-US')).toBe('1,234.5');
  });
});

describe('formatDate', () => {
  it('writes a date the way the locale does', () => {
    expect(formatDate('2024-05-01', 'en-US')).toBe('May 1, 2024');
  });
});
