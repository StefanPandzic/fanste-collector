import { describe, expect, it } from 'vitest';

import {
  markRemovedInList,
  mergeScannedFiles,
  toScannedFile,
  toScannedFileRow,
} from './scanned-files';

import type { ScannedFile } from './scanned-files';
import type { ScannedFileUpsert } from '@fanste/core';

const deviceId = '7c2e4a1b-3d5f-4e6a-8b9c-0d1e2f3a4b5c';
const scannedAt = '2026-10-10T12:00:00.000Z';

const row = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  device_id: deviceId,
  path_key: 'e:/movies/inception (2010)/inception.mkv',
  file_path: 'E:\\Movies\\Inception (2010)\\Inception.mkv',
  file_size: 4_294_967_296,
  file_modified_at: '2026-09-01T18:30:00+00:00',
  parsed_title: 'Inception',
  parsed_year: 2010,
  match_status: 'matched',
  match_confidence: 0.97,
  collection_item_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  scanned_at: scannedAt,
  removed_at: null,
  subtitle_languages: ['en'],
};

const inception: ScannedFile = {
  id: row.id,
  deviceId,
  pathKey: row.path_key,
  filePath: row.file_path,
  size: row.file_size,
  modifiedAt: row.file_modified_at,
  parsedTitle: 'Inception',
  parsedYear: 2010,
  matchStatus: 'matched',
  matchConfidence: 0.97,
  collectionItemId: row.collection_item_id,
  scannedAt,
  removedAt: null,
  subtitleLanguages: ['en'],
};

const dune: ScannedFile = {
  ...inception,
  id: '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
  pathKey: 'e:/movies/dune (2021)/dune.mkv',
  filePath: 'E:\\Movies\\Dune (2021)\\Dune.mkv',
};

const upsert: ScannedFileUpsert = {
  pathKey: row.path_key,
  filePath: row.file_path,
  size: row.file_size,
  modifiedAt: '2026-09-01T18:30:00.000Z',
  subtitleLanguages: ['en'],
  resetMatch: true,
};

describe('toScannedFile', () => {
  it('maps a row to a scanned file', () => {
    expect(toScannedFile(row)).toEqual(inception);
  });

  it('treats an unknown status as pending', () => {
    expect(toScannedFile({ ...row, match_status: 'queued' }).matchStatus).toBe('pending');
  });
});

describe('toScannedFileRow', () => {
  it('resets the match columns of a reset upsert', () => {
    expect(toScannedFileRow(deviceId, upsert, scannedAt)).toEqual({
      device_id: deviceId,
      path_key: upsert.pathKey,
      file_path: upsert.filePath,
      file_size: upsert.size,
      file_modified_at: upsert.modifiedAt,
      subtitle_languages: ['en'],
      scanned_at: scannedAt,
      removed_at: null,
      match_status: 'pending',
      match_confidence: null,
    });
  });

  it('leaves the match columns out when the match is kept', () => {
    const kept = toScannedFileRow(deviceId, { ...upsert, resetMatch: false }, scannedAt);
    expect(kept).not.toHaveProperty('match_status');
    expect(kept).not.toHaveProperty('match_confidence');
  });
});

describe('mergeScannedFiles', () => {
  it('replaces stored rows in place and adds new ones last', () => {
    const changed = { ...inception, size: 5_000_000_000 };
    expect(mergeScannedFiles([inception], [changed, dune])).toEqual([changed, dune]);
  });
});

describe('markRemovedInList', () => {
  it('sets removedAt on the given files', () => {
    const removedAt = '2026-10-10T12:30:00.000Z';
    expect(markRemovedInList([inception, dune], [dune.id], removedAt)).toEqual([
      inception,
      { ...dune, removedAt },
    ]);
  });
});
