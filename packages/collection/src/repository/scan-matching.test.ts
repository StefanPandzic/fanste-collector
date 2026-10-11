import { describe, expect, it } from 'vitest';

import {
  addScannedCopies,
  fillScannedCopyDetails,
  findScannedCopies,
  getItemFileDetails,
  linkFilesToItem,
  relinkScannedFiles,
  saveScanMatches,
} from './scan-matching';

import type { ScanMatch } from './scan-matching';
import type { ScannedFile, ScannedFileRow } from './scanned-files';
import type { NormalizedItem } from '@fanste/core';
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

const removedCopyId = '4d5e6f70-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

const inceptionRow: ScannedFileRow = {
  id: inceptionFileId,
  device_id: '7c2e4a1b-3d5f-4e6a-8b9c-0d1e2f3a4b5c',
  path_key: 'e:/movies/inception (2010)/inception.2010.2160p.mkv',
  file_path: 'E:\\Movies\\Inception (2010)\\Inception.2010.2160p.mkv',
  file_size: 4_294_967_296,
  file_modified_at: '2026-09-01T18:30:00+00:00',
  parsed_title: 'Inception',
  parsed_year: 2010,
  match_status: 'unmatched',
  match_confidence: 0.7,
  collection_item_id: null,
  scanned_at: '2026-10-10T12:00:00.000Z',
  removed_at: null,
  subtitle_languages: [],
  media_info: null,
  match_candidates: null,
};

const inceptionFile: ScannedFile = {
  id: inceptionFileId,
  deviceId: inceptionRow.device_id,
  pathKey: inceptionRow.path_key,
  filePath: inceptionRow.file_path,
  size: inceptionRow.file_size,
  modifiedAt: inceptionRow.file_modified_at,
  parsedTitle: 'Inception',
  parsedYear: 2010,
  mediaInfo: null,
  matchStatus: 'unmatched',
  matchConfidence: 0.7,
  matchCandidates: null,
  collectionItemId: null,
  scannedAt: inceptionRow.scanned_at,
  removedAt: null,
  subtitleLanguages: [],
};

const inception: NormalizedItem = { ...inceptionResult };

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

/** `collection_items` lookups and inserts, and the RPCs, as `linkFilesToItem` uses them. */
function createRelinkClient(copies: { id: string; category: string; details: unknown }[] = []) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () =>
          Promise.resolve({
            data: copies.map((copy) => ({ ...copy, external_id: 'movie:27205' })),
            error: null,
          }),
        upsert: (rows: unknown[]) => {
          calls.push({ fn: 'collection_items.upsert', args: { rows } });
          copies.push({ id: inceptionCopyId, category: 'movie', details: {} });
          return {
            select: () => Promise.resolve({ data: [{ id: inceptionCopyId }], error: null }),
          };
        },
      };
      return builder;
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn !== 'relink_scanned_files') return Promise.resolve({ data: null, error: null });
      return Promise.resolve({
        data: {
          files: (args.p_ids as string[]).map((id) => ({
            ...inceptionRow,
            id,
            match_status: args.p_status,
            collection_item_id: args.p_item_id ?? null,
          })),
          removedItemIds: [removedCopyId],
        },
        error: null,
      });
    },
  } as unknown as FansteSupabaseClient;
  return { client, calls };
}

describe('relinkScannedFiles', () => {
  it('links files by hand and maps the stored files and removed items', async () => {
    const { client, calls } = createRelinkClient();
    const result = await relinkScannedFiles(client, [inceptionFileId], {
      status: 'manual',
      itemId: inceptionCopyId,
    });
    expect(calls).toEqual([
      {
        fn: 'relink_scanned_files',
        args: { p_ids: [inceptionFileId], p_status: 'manual', p_item_id: inceptionCopyId },
      },
    ]);
    expect(result).toEqual({
      files: [{ ...inceptionFile, matchStatus: 'manual', collectionItemId: inceptionCopyId }],
      removedItemIds: [removedCopyId],
    });
  });

  it('sends no item for ignored files and splits the ids by 500', async () => {
    const { client, calls } = createRelinkClient();
    const ids = Array.from({ length: 501 }, (_, index) => `file-${index}`);
    const result = await relinkScannedFiles(client, ids, { status: 'ignored' });
    expect(calls.map(({ args }) => (args.p_ids as string[]).length)).toEqual([500, 1]);
    expect(calls[0]?.args.p_status).toBe('ignored');
    expect(calls[0]?.args).not.toHaveProperty('p_item_id');
    expect(result.files).toHaveLength(501);
  });
});

describe('linkFilesToItem', () => {
  it('adds a Digital file copy from the scanner and links the files to it', async () => {
    const { client, calls } = createRelinkClient();
    const result = await linkFilesToItem(client, inception, [inceptionFile]);
    expect(calls.map((call) => call.fn)).toEqual([
      'collection_items.upsert',
      'relink_scanned_files',
    ]);
    expect(calls[0]?.args.rows).toMatchObject([
      { external_id: 'movie:27205', format: 'Digital file', source: 'scanner' },
    ]);
    expect(calls[1]?.args).toEqual({
      p_ids: [inceptionFileId],
      p_status: 'manual',
      p_item_id: inceptionCopyId,
    });
    expect(result.itemId).toBe(inceptionCopyId);
  });

  it('fills the empty details of an existing copy before linking', async () => {
    const { client, calls } = createRelinkClient([
      { id: inceptionCopyId, category: 'movie', details: { resolution: '1080p' } },
    ]);
    await linkFilesToItem(client, inception, [inceptionFile]);
    expect(calls.map((call) => call.fn)).toEqual(['merge_item_details', 'relink_scanned_files']);
    expect(calls[0]?.args).toEqual({
      p_id: inceptionCopyId,
      p_category: 'movie',
      p_patch: { fileFormat: 'MKV' },
    });
  });

  it('deletes the copy it added when the relink fails', async () => {
    const copies: { id: string; category: string; external_id: string; details: unknown }[] = [];
    const deleted: [string, unknown][] = [];
    const client = {
      from: (table: string) => {
        const builder = {
          select: () => builder,
          eq: () =>
            table === 'scanned_files' ? Promise.resolve({ count: 0, error: null }) : builder,
          in: () => Promise.resolve({ data: copies, error: null }),
          upsert: () => {
            copies.push({
              id: inceptionCopyId,
              category: 'movie',
              external_id: 'movie:27205',
              details: {},
            });
            return {
              select: () => Promise.resolve({ data: [{ id: inceptionCopyId }], error: null }),
            };
          },
          delete: () => {
            const filter = {
              eq: (column: string, value: unknown) => {
                deleted.push([column, value]);
                return filter;
              },
            };
            return filter;
          },
        };
        return builder;
      },
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: '40001', message: 'could not serialize access due to concurrent update' },
        }),
    } as unknown as FansteSupabaseClient;

    await expect(linkFilesToItem(client, inception, [inceptionFile])).rejects.toThrow(
      /concurrent update/,
    );
    expect(deleted).toEqual([
      ['id', inceptionCopyId],
      ['source', 'scanner'],
    ]);
  });
});
