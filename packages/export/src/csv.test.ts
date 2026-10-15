import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';

import { buildCollectionCsv, UTF8_BOM } from './csv';

import type { CollectionItem, Tag } from '@fanste/core';

const steelbookTag: Tag = {
  id: '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
  name: 'Steelbook',
  color: null,
};
const signedTag: Tag = { id: '8d2e1f3a-4b5c-4d6e-9f0a-1b2c3d4e5f60', name: 'Signed', color: null };
const noLookups = { tags: [], collections: [] };

const inception: CollectionItem = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  userId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  category: 'movie',
  provider: 'tmdb',
  externalId: 'movie:27205',
  customCollectionId: null,
  customData: null,
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
  },
};

const abbeyRoad: CollectionItem = {
  ...inception,
  id: '7c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f',
  category: 'music',
  provider: 'discogs',
  externalId: 'release:2607424',
  format: 'Vinyl',
  details: {},
  acquiredAt: null,
  estimatedValue: 80,
  metadata: {
    provider: 'discogs',
    externalId: 'release:2607424',
    category: 'music',
    title: 'Abbey Road',
    subtitle: 'The Beatles',
    releaseYear: 1969,
  },
};

const matrix: CollectionItem = {
  ...inception,
  id: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
  externalId: 'movie:603',
  acquiredAt: '2025-01-12',
  estimatedValue: null,
  metadata: {
    provider: 'tmdb',
    externalId: 'movie:603',
    category: 'movie',
    title: 'The Matrix',
    releaseYear: 1999,
  },
};

/** The CSV's rows as cells, header first. */
function rowsOf(csv: string): string[][] {
  return Papa.parse<string[]>(csv.slice(UTF8_BOM.length), { newline: '\r\n' }).data;
}

/** One column's cells, without the header. */
function columnOf(csv: string, header: string): (string | undefined)[] {
  const [headers = [], ...rows] = rowsOf(csv);
  const index = headers.indexOf(header);
  return rows.map((row) => row[index]);
}

describe('buildCollectionCsv', () => {
  it('writes a header and one row per copy, with a BOM and CRLF line ends', () => {
    const csv = buildCollectionCsv([inception], noLookups);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const lines = csv.slice(UTF8_BOM.length).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Category,Title,Subtitle,Year');
    expect(lines[1]).toContain('Movie,Inception,Christopher Nolan,2010');
  });

  it('escapes commas, quotes, newlines and empty values', () => {
    const csv = buildCollectionCsv(
      [
        {
          ...inception,
          metadataOverrides: { title: 'Crouching Tiger, Hidden Dragon' },
          notes: 'Signed "Ang Lee"\nBought at a con',
        },
      ],
      noLookups,
    );
    expect(csv).toContain('"Crouching Tiger, Hidden Dragon"');
    expect(csv).toContain('"Signed ""Ang Lee""\nBought at a con"');
    expect(csv).toContain('4K UHD Blu-ray,Owned,1,2024-05-01,,24.99,EUR');
    expect(columnOf(csv, 'Notes')).toEqual(['Signed "Ang Lee"\nBought at a con']);
    expect(columnOf(csv, 'Purchase price')).toEqual(['']);
  });

  it('applies overrides to the title and year', () => {
    const csv = buildCollectionCsv(
      [{ ...inception, metadataOverrides: { title: 'Inception (Steelbook)', releaseYear: 2011 } }],
      noLookups,
    );
    expect(columnOf(csv, 'Title')).toEqual(['Inception (Steelbook)']);
    expect(columnOf(csv, 'Year')).toEqual(['2011']);
    expect(rowsOf(csv)[0]).not.toContain('Original title');
  });

  it('adds the original title, subtitle and year with includeOriginal', () => {
    const csv = buildCollectionCsv(
      [{ ...inception, metadataOverrides: { title: 'Inception (Steelbook)', releaseYear: 2011 } }],
      { ...noLookups, includeOriginal: true },
    );
    expect(columnOf(csv, 'Original title')).toEqual(['Inception']);
    expect(columnOf(csv, 'Original subtitle')).toEqual(['Christopher Nolan']);
    expect(columnOf(csv, 'Original year')).toEqual(['2010']);
  });

  it('sorts by category, then title, by default', () => {
    const csv = buildCollectionCsv([abbeyRoad, matrix, inception], noLookups);
    expect(columnOf(csv, 'Title')).toEqual(['Inception', 'The Matrix', 'Abbey Road']);
  });

  it('sorts by acquisition date or value, largest first and blanks last', () => {
    const items = [abbeyRoad, inception, matrix];
    expect(
      columnOf(buildCollectionCsv(items, { ...noLookups, sort: 'acquired' }), 'Title'),
    ).toEqual(['The Matrix', 'Inception', 'Abbey Road']);
    expect(columnOf(buildCollectionCsv(items, { ...noLookups, sort: 'value' }), 'Title')).toEqual([
      'Abbey Road',
      'Inception',
      'The Matrix',
    ]);
  });

  it('writes the names of the tags', () => {
    const csv = buildCollectionCsv([{ ...inception, tagIds: [steelbookTag.id, signedTag.id] }], {
      ...noLookups,
      tags: [steelbookTag, signedTag],
    });
    expect(columnOf(csv, 'Tags')).toEqual(['Steelbook; Signed']);
  });

  it('prefixes cells that start like a formula with a quote', () => {
    const csv = buildCollectionCsv(
      [{ ...inception, metadataOverrides: { title: '=HYPERLINK("https://evil.example")' } }],
      noLookups,
    );
    expect(columnOf(csv, 'Title')).toEqual(['\'=HYPERLINK("https://evil.example")']);
  });

  it('prefixes a multi-line cell that starts like a formula', () => {
    const csv = buildCollectionCsv(
      [{ ...inception, notes: '=HYPERLINK("https://evil.example","Click")\nsecond line' }],
      noLookups,
    );
    expect(columnOf(csv, 'Notes')).toEqual([
      '\'=HYPERLINK("https://evil.example","Click")\nsecond line',
    ]);
  });

  it('builds 5,000 items in under 3 seconds', () => {
    const items = Array.from({ length: 5000 }, (_, index) => ({
      ...(index % 2 === 0 ? inception : abbeyRoad),
      id: `${index}`,
      notes: `Shelf ${index}, row "B"`,
      tagIds: [steelbookTag.id],
    }));
    const start = performance.now();
    const csv = buildCollectionCsv(items, { ...noLookups, tags: [steelbookTag] });
    expect(performance.now() - start).toBeLessThan(3000);
    expect(rowsOf(csv)).toHaveLength(5001);
  });
});
