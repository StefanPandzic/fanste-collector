import { describe, expect, it } from 'vitest';

import {
  addScannedCopies,
  fillScannedCopyDetails,
  findScannedCopies,
  getItemFileDetails,
  saveScanMatches,
} from './scan-matching';

import type { ScanMatch } from './scan-matching';
import type { FansteSupabaseClient } from '@fanste/supabase';

const inceptionFileId = '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70';
const inceptionCopyId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const inceptionResult = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
} as const;

function createFakeClient() {
  const calls: { fn: string; args: unknown; options?: unknown }[] = [];
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { error: null, select: () => Promise.resolve({ data: [], error: null }) };
    },
    from: (table: string) => ({
      upsert: (rows: unknown[], options: unknown) => {
        calls.push({ fn: `${table}.upsert`, args: rows, options });
        return {
          select: () =>
            Promise.resolve({ data: rows.map((_, index) => ({ id: `${index}` })), error: null }),
        };
      },
    }),
  } as unknown as FansteSupabaseClient;
  return { client, calls };
}

describe('findScannedCopies', () => {
  it('finds Digital file copies by the format key the unique constraint uses', async () => {
    const filters: [string, unknown][] = [];
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      in: () =>
        Promise.resolve({
          data: [
            { id: inceptionCopyId, category: 'movie', external_id: 'movie:27205', details: {} },
          ],
          error: null,
        }),
    };
    const client = { from: () => builder } as unknown as FansteSupabaseClient;

    const copies = await findScannedCopies(client, [
      { provider: 'tmdb', externalId: 'movie:27205' },
    ]);

    expect(filters).toEqual([
      ['provider', 'tmdb'],
      ['format_key', 'digital file'],
    ]);
    expect(copies.get('tmdb:movie:27205')).toEqual({
      id: inceptionCopyId,
      category: 'movie',
      details: {},
    });
  });
});

describe('saveScanMatches', () => {
  it('sends the match results to set_scan_matches', async () => {
    const { client, calls } = createFakeClient();
    const match: ScanMatch = {
      id: inceptionFileId,
      status: 'matched',
      confidence: 0.97,
      candidates: [{ item: inceptionResult, confidence: 0.97 }],
      collectionItemId: inceptionCopyId,
    };
    await saveScanMatches(client, [match]);
    expect(calls).toEqual([
      {
        fn: 'set_scan_matches',
        args: {
          p_matches: [
            {
              id: inceptionFileId,
              match_status: 'matched',
              match_confidence: 0.97,
              match_candidates: [{ item: inceptionResult, confidence: 0.97 }],
              collection_item_id: inceptionCopyId,
            },
          ],
        },
      },
    ]);
  });
});

describe('addScannedCopies', () => {
  it('inserts the copies with their file details, skipping ones that exist', async () => {
    const { client, calls } = createFakeClient();
    const added = await addScannedCopies(client, [
      {
        input: {
          category: 'movie',
          provider: 'tmdb',
          externalId: 'movie:27205',
          format: 'Digital file',
          ownership: 'owned',
          details: { resolution: '2160p', audioChannels: '7.1' },
          source: 'scanner',
        },
        fileDetails: { audioChannels: '7.1' },
      },
    ]);
    expect(added).toBe(1);
    expect(calls[0]).toMatchObject({
      fn: 'collection_items.upsert',
      args: [
        {
          external_id: 'movie:27205',
          format: 'Digital file',
          source: 'scanner',
          details: { resolution: '2160p', audioChannels: '7.1' },
          file_details: { audioChannels: '7.1' },
        },
      ],
      options: { onConflict: 'user_id,provider,external_id,format_key', ignoreDuplicates: true },
    });
  });
});

describe('fillScannedCopyDetails', () => {
  it('merges the patch and records the file details', async () => {
    const { client, calls } = createFakeClient();
    await fillScannedCopyDetails(
      client,
      inceptionCopyId,
      'movie',
      { resolution: '2160p', fileFormat: 'MKV' },
      { resolution: '2160p' },
    );
    expect(calls).toEqual([
      {
        fn: 'merge_item_details',
        args: {
          p_id: inceptionCopyId,
          p_category: 'movie',
          p_patch: { resolution: '2160p', fileFormat: 'MKV' },
        },
      },
      {
        fn: 'merge_item_file_details',
        args: { p_id: inceptionCopyId, p_values: { resolution: '2160p' } },
      },
    ]);
  });

  it('skips merge_item_file_details without file details', async () => {
    const { client, calls } = createFakeClient();
    await fillScannedCopyDetails(client, inceptionCopyId, 'movie', { fileFormat: 'MKV' });
    expect(calls.map((call) => call.fn)).toEqual(['merge_item_details']);
  });
});

describe('getItemFileDetails', () => {
  it('reads the valid fields of the stored file_details', async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: () =>
        Promise.resolve({
          data: {
            file_details: { resolution: '2160p', audioLanguages: ['en'], edition: 'Steelbook' },
          },
          error: null,
        }),
    };
    const client = { from: () => builder } as unknown as FansteSupabaseClient;
    expect(await getItemFileDetails(client, inceptionCopyId)).toEqual({
      resolution: '2160p',
      audioLanguages: ['en'],
    });
  });
});
