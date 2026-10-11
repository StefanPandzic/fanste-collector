import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@fanste/api-client';

import { createScanMatchRunner } from './match-runner';

import type { ScanMatchSummary } from './match-runner';
import type { ScannedFile } from '../repository/scanned-files';
import type { ApiClient } from '@fanste/api-client';
import type { MatchQuery, MatchResponse, NormalizedItem, ScannerSettings } from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

const inceptionCopyId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const pending: ScannedFile = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  deviceId: '7c2e4a1b-3d5f-4e6a-8b9c-0d1e2f3a4b5c',
  pathKey: 'e:/movies/inception (2010)/inception.2010.2160p.mkv',
  filePath: 'E:\\Movies\\Inception (2010)\\Inception.2010.2160p.mkv',
  size: 4_294_967_296,
  modifiedAt: '2026-09-01T18:30:00+00:00',
  parsedTitle: 'Inception',
  parsedYear: 2010,
  mediaInfo: null,
  matchStatus: 'pending',
  matchConfidence: null,
  matchCandidates: null,
  collectionItemId: null,
  scannedAt: '2026-10-10T12:00:00.000Z',
  removedAt: null,
  subtitleLanguages: [],
};

const inception: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
};

const inceptionResult = {
  provider: 'tmdb',
  externalId: 'movie:27205',
  category: 'movie',
  title: 'Inception',
  releaseYear: 2010,
} as const;

type Answer = MatchResponse['results'][number];

const confident: Answer = { candidates: [{ item: inceptionResult, confidence: 1 }] };
const unsure: Answer = { candidates: [{ item: inceptionResult, confidence: 0.7 }] };
const failed: Answer = { candidates: [], failed: true };

interface StoredMatch {
  id: string;
  match_status: string;
  match_confidence: number | null;
  match_candidates: unknown;
  collection_item_id: string | null;
}

/** An in-memory `collection_items` and `scanned_files`, as far as the runner uses them. */
function createFakeClient() {
  const copies: { id: string; category: string; external_id: string; details: unknown }[] = [];
  const inserted: Record<string, unknown>[] = [];
  const matches: StoredMatch[] = [];
  const client = {
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: (_column: string, ids: string[]) =>
          Promise.resolve({
            data: copies.filter((copy) => ids.includes(copy.external_id)),
            error: null,
          }),
        upsert: (rows: Record<string, unknown>[]) => {
          inserted.push(...rows);
          for (const row of rows) {
            copies.push({
              id: inceptionCopyId,
              category: row.category as string,
              external_id: row.external_id as string,
              details: row.details,
            });
          }
          return {
            select: () =>
              Promise.resolve({ data: rows.map(() => ({ id: inceptionCopyId })), error: null }),
          };
        },
      };
      return builder;
    },
    rpc: (_fn: string, args: { p_matches: StoredMatch[] }) => {
      matches.push(...args.p_matches);
      return {
        select: () =>
          Promise.resolve({
            data: args.p_matches.map((match) => ({
              id: match.id,
              device_id: pending.deviceId,
              path_key: pending.pathKey,
              file_path: pending.filePath,
              file_size: pending.size,
              file_modified_at: pending.modifiedAt,
              parsed_title: pending.parsedTitle,
              parsed_year: pending.parsedYear,
              match_status: match.match_status,
              match_confidence: match.match_confidence,
              match_candidates: match.match_candidates,
              collection_item_id: match.collection_item_id,
              scanned_at: pending.scannedAt,
              removed_at: null,
              subtitle_languages: [],
              media_info: null,
            })),
            error: null,
          }),
      };
    },
  } as unknown as FansteSupabaseClient;
  return { client, inserted, matches };
}

function createFakeApi(answer: Answer) {
  const batches: unknown[] = [];
  const api = {
    matchTmdb: (queries: readonly MatchQuery[]) =>
      Promise.resolve({ results: queries.map(() => answer) }),
    getItemsBatch: (refs: unknown) => {
      batches.push(refs);
      return Promise.resolve({ items: [inception], missing: [] });
    },
  } as unknown as ApiClient;
  return { api, batches };
}

function runMatcher(
  answer: Answer,
  settings: ScannerSettings = { autoAdd: true },
  {
    files: initialFiles = [pending],
    api: apiOverride,
  }: { files?: ScannedFile[]; api?: Partial<ApiClient> } = {},
) {
  const { client, inserted, matches } = createFakeClient();
  const fake = createFakeApi(answer);
  const api = { ...fake.api, ...apiOverride };
  const { batches } = fake;
  let files: ScannedFile[] = initialFiles;
  const runner = createScanMatchRunner({
    client,
    api,
    pendingFiles: () => files,
    settings: () => Promise.resolve(settings),
    onFilesStored: (stored) => {
      const ids = new Set(stored.map((file) => file.id));
      files = files.filter((file) => !ids.has(file.id));
    },
    onCollectionChanged: () => {},
    sleep: async () => {},
    requestGapMs: 0,
  });
  const summary = new Promise<ScanMatchSummary>((resolve) => {
    runner.onFinished(resolve);
  });
  runner.start();
  return summary.then((result) => ({ summary: result, inserted, matches, batches }));
}

describe('createScanMatchRunner', () => {
  it('adds a confident match to the collection and stores it as matched', async () => {
    const { summary, inserted, matches } = await runMatcher(confident);
    expect(inserted).toEqual([
      expect.objectContaining({
        external_id: 'movie:27205',
        format: 'Digital file',
        source: 'scanner',
        ownership: 'owned',
      }),
    ]);
    expect(matches).toEqual([
      {
        id: pending.id,
        match_status: 'matched',
        match_confidence: 1,
        match_candidates: confident.candidates,
        collection_item_id: inceptionCopyId,
      },
    ]);
    expect(summary).toEqual({ added: 1, review: 0, remaining: 0 });
  });

  it('records the header values of an added copy in file_details', async () => {
    const { inserted } = await runMatcher(
      confident,
      { autoAdd: true },
      { files: [{ ...pending, mediaInfo: { resolution: '2160p', audioChannels: '7.1' } }] },
    );
    expect(inserted[0]?.details).toEqual({
      fileFormat: 'MKV',
      resolution: '2160p',
      audioChannels: '7.1',
    });
    expect(inserted[0]?.file_details).toEqual({ resolution: '2160p', audioChannels: '7.1' });
  });

  it('leaves an unsure match, or any match with auto-add off, for review', async () => {
    const review = await runMatcher(unsure);
    expect(review.inserted).toEqual([]);
    expect(review.matches).toEqual([
      {
        id: pending.id,
        match_status: 'unmatched',
        match_confidence: 0.7,
        match_candidates: unsure.candidates,
        collection_item_id: null,
      },
    ]);
    expect(review.summary).toEqual({ added: 0, review: 1, remaining: 0 });

    const manual = await runMatcher(confident, { autoAdd: false });
    expect(manual.batches).toEqual([]);
    expect(manual.inserted).toEqual([]);
    expect(manual.matches[0]?.match_status).toBe('unmatched');
    expect(manual.summary).toEqual({ added: 0, review: 1, remaining: 0 });
  });

  it('keeps a file pending when its search failed', async () => {
    const { summary, matches } = await runMatcher(failed);
    expect(matches).toEqual([]);
    expect(summary).toEqual({ added: 0, review: 0, remaining: 1 });
  });

  it('keeps confident files pending, and gives up after three batches, when metadata fails', async () => {
    const files = Array.from({ length: 61 }, (_, index) => ({
      ...pending,
      id: `file-${index}`,
      pathKey: `e:/movies/title ${index}.mkv`,
      filePath: `E:\\Movies\\Title ${index}.mkv`,
    }));
    let matchCalls = 0;
    const { summary, inserted, matches } = await runMatcher(
      confident,
      { autoAdd: true },
      {
        files,
        api: {
          matchTmdb: (queries) => {
            matchCalls++;
            return Promise.resolve({ results: queries.map(() => confident) });
          },
          getItemsBatch: () =>
            Promise.reject(new ApiClientError(502, 'provider_error', 'TMDB failed.', 'tmdb')),
        },
      },
    );

    expect(matchCalls).toBe(3);
    expect(inserted).toEqual([]);
    expect(matches).toEqual([]);
    expect(summary).toEqual({ added: 0, review: 0, remaining: 61 });
  });
});
