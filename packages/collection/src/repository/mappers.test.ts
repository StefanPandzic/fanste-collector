import { describe, expect, it } from 'vitest';

import { addItemInputSchema } from '@fanste/core';

import {
  fromInsertedRow,
  toCollectionItem,
  toCollectionStats,
  toInsertRow,
  toRestoreRow,
  toUpdateRow,
} from './mappers';

import type { ItemViewRow } from './mappers';
import type { NormalizedItem } from '@fanste/core';
import type { Tables } from '@fanste/supabase';

const itemId = '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70';
const userId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const tagId = '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f';
const posterUrl = 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg';

const viewRow: ItemViewRow = {
  id: itemId,
  user_id: userId,
  category: 'movie',
  provider: 'tmdb',
  external_id: 'movie:27205',
  format: '4K UHD Blu-ray',
  details: { edition: 'Steelbook' },
  metadata_overrides: {},
  custom_data: null,
  ownership: 'owned',
  quantity: 1,
  acquired_at: '2026-01-31',
  purchase_price: 24.99,
  estimated_value: 30,
  currency: 'EUR',
  notes: null,
  source: 'search',
  created_at: '2026-09-25T14:02:32.123456+00:00',
  updated_at: '2026-09-25T14:02:32.123456+00:00',
  title: 'Inception',
  subtitle: null,
  release_year: 2010,
  image_url: posterUrl,
  provider_title: 'Inception',
  provider_subtitle: null,
  provider_release_year: 2010,
  provider_image_url: posterUrl,
  metadata_fetched_at: '2026-09-25T14:02:30+00:00',
  metadata_payload: { genres: ['Action', 'Science Fiction'] },
  collection_item_tags: [{ tag_id: tagId }],
};

const inception: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
  imageUrl: posterUrl,
  genres: ['Action', 'Science Fiction'],
};

describe('toCollectionItem', () => {
  it('maps a view row with its tags and cached metadata', () => {
    expect(toCollectionItem(viewRow)).toEqual({
      id: itemId,
      userId,
      category: 'movie',
      provider: 'tmdb',
      externalId: 'movie:27205',
      format: '4K UHD Blu-ray',
      details: { edition: 'Steelbook' },
      metadataOverrides: {},
      ownership: 'owned',
      quantity: 1,
      acquiredAt: '2026-01-31',
      purchasePrice: 24.99,
      estimatedValue: 30,
      currency: 'EUR',
      notes: null,
      source: 'search',
      createdAt: '2026-09-25T14:02:32.123456+00:00',
      updatedAt: '2026-09-25T14:02:32.123456+00:00',
      tagIds: [tagId],
      metadata: inception,
    });
  });

  it('has no metadata when it is not cached yet or the item is custom', () => {
    expect(toCollectionItem({ ...viewRow, metadata_fetched_at: null }).metadata).toBeNull();
    expect(
      toCollectionItem({ ...viewRow, provider: 'custom', category: 'funko', external_id: null })
        .metadata,
    ).toBeNull();
  });
});

describe('toInsertRow', () => {
  it('maps a parsed input without user_id or format_key', () => {
    const input = addItemInputSchema.parse({
      category: 'movie',
      provider: 'tmdb',
      externalId: 'movie:27205',
      format: '4K UHD Blu-ray',
      ownership: 'owned',
    });
    expect(toInsertRow(input)).toEqual({
      category: 'movie',
      provider: 'tmdb',
      external_id: 'movie:27205',
      details: {},
      source: 'manual',
      format: '4K UHD Blu-ray',
      ownership: 'owned',
    });
  });
});

describe('toRestoreRow', () => {
  it('puts the copy back with its ID, details, overrides and creation time', () => {
    const item = toCollectionItem({ ...viewRow, metadata_overrides: { title: 'Inception (4K)' } });
    expect(toRestoreRow(item)).toEqual({
      id: itemId,
      category: 'movie',
      provider: 'tmdb',
      external_id: 'movie:27205',
      format: '4K UHD Blu-ray',
      details: { edition: 'Steelbook' },
      metadata_overrides: { title: 'Inception (4K)' },
      ownership: 'owned',
      quantity: 1,
      acquired_at: '2026-01-31',
      purchase_price: 24.99,
      estimated_value: 30,
      currency: 'EUR',
      notes: null,
      source: 'search',
      created_at: '2026-09-25T14:02:32.123456+00:00',
    });
  });
});

describe('toUpdateRow', () => {
  it('sends only the fields present in the patch', () => {
    expect(toUpdateRow({ ownership: 'sold', notes: null })).toEqual({
      ownership: 'sold',
      notes: null,
    });
  });
});

describe('fromInsertedRow', () => {
  it('maps an inserted row with the metadata the caller already has', () => {
    const row: Tables<'collection_items'> = {
      id: itemId,
      user_id: userId,
      category: 'movie',
      provider: 'tmdb',
      external_id: 'movie:27205',
      format: '4K UHD Blu-ray',
      format_key: '4k uhd blu-ray',
      details: {},
      metadata_overrides: {},
      custom_data: null,
      ownership: 'owned',
      quantity: 1,
      acquired_at: null,
      purchase_price: null,
      estimated_value: null,
      currency: null,
      notes: null,
      source: 'search',
      created_at: '2026-09-25T14:02:32.123456+00:00',
      updated_at: '2026-09-25T14:02:32.123456+00:00',
    };
    const item = fromInsertedRow(row, inception);
    expect(item.id).toBe(itemId);
    expect(item.format).toBe('4K UHD Blu-ray');
    expect(item.tagIds).toEqual([]);
    expect(item.metadata).toEqual(inception);
    expect(item).not.toHaveProperty('formatKey');
  });
});

describe('toCollectionStats', () => {
  it('totals copies per category and status, and values only the copies the user has', () => {
    const stats = toCollectionStats([
      {
        category: 'movie',
        ownership: 'owned',
        currency: 'EUR',
        item_count: 2,
        quantity_total: 3,
        estimated_value_total: 45.5,
      },
      {
        category: 'tv',
        ownership: 'loaned_out',
        currency: 'USD',
        item_count: 1,
        quantity_total: 1,
        estimated_value_total: 60,
      },
      {
        category: 'music',
        ownership: 'wishlist',
        currency: 'EUR',
        item_count: 1,
        quantity_total: 1,
        estimated_value_total: 20,
      },
      {
        category: 'movie',
        ownership: 'sold',
        currency: 'EUR',
        item_count: 1,
        quantity_total: 1,
        estimated_value_total: 15,
      },
    ]);
    expect(stats.totals).toEqual({ items: 5, quantity: 6 });
    expect(stats.byCategory.movie).toEqual({ items: 3, quantity: 4 });
    expect(stats.byCategory.funko).toEqual({ items: 0, quantity: 0 });
    expect(stats.byOwnership.wishlist).toEqual({ items: 1, quantity: 1 });
    expect(stats.estimatedValue).toEqual([
      { currency: 'USD', total: 60 },
      { currency: 'EUR', total: 45.5 },
    ]);
  });
});
