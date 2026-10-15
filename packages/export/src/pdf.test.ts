import { describe, expect, it } from 'vitest';

import { buildCollectionPdf, printedTexts } from './pdf';
import { fontNeeds } from './pdf-fonts';
import { buildPdfModel } from './pdf-model';

import type { PdfCover } from './pdf';
import type { CollectionItem } from '@fanste/core';

const exportDate = new Date(2026, 9, 15, 10, 0);
const tinyJpeg =
  '/9j/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAADAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCYANW//9k=';

const inception: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
  customCollectionId: null,
  customData: null,
  format: '4K UHD Blu-ray',
  details: {},
  metadataOverrides: {},
  ownership: 'owned',
  quantity: 1,
  acquiredAt: null,
  purchasePrice: null,
  estimatedValue: 25.99,
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
    releaseYear: 2010,
  },
};

function movies(count: number): CollectionItem[] {
  return Array.from({ length: count }, (_, index) => ({
    ...inception,
    id: `3f6c1e2a-8b4d-4c5e-9f7a-${String(index).padStart(12, '0')}`,
    externalId: `movie:${27205 + index}`,
    metadata: {
      provider: 'tmdb' as const,
      externalId: `movie:${27205 + index}`,
      category: 'movie' as const,
      title: `Inception ${index + 1}`,
      thumbnailUrl: `https://image.tmdb.org/t/p/w185/cover-${index}.jpg`,
    },
  }));
}

function pageCount(data: Uint8Array): number {
  return new TextDecoder('latin1').decode(data).match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;
}

const options = {
  paper: 'a4' as const,
  includePrices: true,
  userName: 'Stefan',
  date: exportDate,
  locale: 'en-GB',
};

describe('buildCollectionPdf', () => {
  it('builds a cover page and a grid page per 20 items', async () => {
    const model = buildPdfModel(movies(21), { layout: 'grid', collections: [] });
    const file = await buildCollectionPdf(model, options);
    expect(file.name).toBe('fanste-collection-2026-10-15.pdf');
    expect(file.type).toBe('pdf');
    expect(file.mimeType).toBe('application/pdf');
    const data = file.data as Uint8Array;
    expect(new TextDecoder().decode(data.slice(0, 4))).toBe('%PDF');
    expect(pageCount(data)).toBe(3);
  });

  it('builds an insurance list', async () => {
    const model = buildPdfModel(movies(3), { layout: 'insurance', collections: [] });
    const file = await buildCollectionPdf(model, { ...options, paper: 'letter' });
    const data = file.data as Uint8Array;
    expect(new TextDecoder().decode(data.slice(0, 4))).toBe('%PDF');
    expect(pageCount(data)).toBe(2);
  });

  it('builds a 500-item catalog with covers under 25 MB', async () => {
    const model = buildPdfModel(movies(500), { layout: 'grid', collections: [] });
    const bytes = Uint8Array.from(atob(tinyJpeg), (char) => char.charCodeAt(0));
    const covers = new Map<string, PdfCover>(
      model.sections
        .flatMap((section) => section.entries)
        .map((entry) => [
          entry.coverUrl ?? '',
          { data: bytes, format: 'JPEG', width: 2, height: 3 },
        ]),
    );
    const file = await buildCollectionPdf(model, { ...options, covers });
    const data = file.data as Uint8Array;
    expect(pageCount(data)).toBe(26);
    expect(new TextDecoder('latin1').decode(data).match(/\/Subtype \/Image/g)).toHaveLength(500);
    expect(data.byteLength).toBeLessThan(25 * 1024 * 1024);
  }, 30_000);
});

describe('printedTexts', () => {
  it('includes dates and amounts, so a Japanese locale loads the CJK font', () => {
    const model = buildPdfModel([inception], { layout: 'insurance', collections: [] });
    const latin = printedTexts(model, { userName: 'Ada', date: exportDate, locale: 'en-US' });
    expect(latin).toContain('October 15, 2026');
    expect(latin).toContain('€25.99');
    expect(fontNeeds(latin)).toEqual({ sc: false, kr: false });

    const japanese = printedTexts(model, { userName: 'Ada', date: exportDate, locale: 'ja-JP' });
    expect(fontNeeds(japanese)).toEqual({ sc: true, kr: false });
  });
});
