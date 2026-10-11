import { describe, expect, it } from 'vitest';

import { filesInFolder, fixGroup, folderKeyOf, topSuggestionGroups } from './fix-match';

import type { FixableFile } from './fix-match';
import type { MatchCandidate } from '../gateway/requests';

const severanceCopyId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const otherCopyId = '7c2e4a1b-3d5f-4e6a-8b9c-0d1e2f3a4b5c';

const inceptionCandidate: MatchCandidate = {
  item: {
    provider: 'tmdb',
    externalId: 'movie:27205',
    category: 'movie',
    title: 'Inception',
    releaseYear: 2010,
  },
  confidence: 0.82,
};

const duneCandidate: MatchCandidate = {
  item: {
    provider: 'tmdb',
    externalId: 'movie:438631',
    category: 'movie',
    title: 'Dune',
    releaseYear: 2021,
  },
  confidence: 0.74,
};

function file(id: string, filePath: string, overrides: Partial<FixableFile> = {}): FixableFile {
  return {
    id,
    deviceId: 'laptop',
    filePath,
    pathKey: filePath.replaceAll('\\', '/').toLowerCase(),
    matchStatus: 'matched',
    collectionItemId: severanceCopyId,
    removedAt: null,
    matchCandidates: null,
    ...overrides,
  };
}

const episode1 = file('a1', 'F:\\Series\\Severance\\Severance.S01E01.mkv');
const episode2 = file('a2', 'F:\\Series\\Severance\\Severance.S01E02.mkv');

describe('fixGroup', () => {
  it('adds the current files with the same query and item', () => {
    const otherItem = file('a3', 'F:\\Series\\Severance\\Severance.S01E03.mkv', {
      collectionItemId: otherCopyId,
    });
    const ignored = file('a4', 'F:\\Series\\Severance\\Severance.S01E04.mkv', {
      matchStatus: 'ignored',
    });
    const removed = file('a5', 'F:\\Series\\Severance\\Severance.S01E05.mkv', {
      removedAt: '2026-10-01T09:00:00Z',
    });
    const dune = file('b1', 'E:\\Movies\\Dune (2021)\\Dune.2021.mkv');
    const otherDevice = file('a6', 'F:\\Series\\Severance\\Severance.S01E06.mkv', {
      deviceId: 'desktop',
    });

    expect(
      fixGroup(episode2, [episode1, episode2, otherItem, ignored, removed, dune, otherDevice]),
    ).toEqual([episode2, episode1]);
  });

  it('fixes a file without a parsed title alone', () => {
    const unnamed = file('c1', 'C:\\Users\\stefan\\Videos\\movie.mkv');
    const other = file('c2', 'C:\\Users\\stefan\\Videos\\movie.mkv');
    expect(fixGroup(unnamed, [unnamed, other])).toEqual([unnamed]);
  });
});

describe('folderKeyOf', () => {
  it('returns the parent folder and keeps a drive root', () => {
    expect(folderKeyOf('e:/movies/inception (2010)/inception.mkv')).toBe(
      'e:/movies/inception (2010)',
    );
    expect(folderKeyOf('e:/inception.mkv')).toBe('e:/');
  });
});

describe('filesInFolder', () => {
  it('returns the current files in the folder and its subfolders', () => {
    const inception = file('d1', 'E:\\Movies\\Inception (2010)\\Inception.mkv');
    const dune = file('d2', 'E:\\Movies\\Dune.2021.mkv');
    const removed = file('d3', 'E:\\Movies\\Tenet.2020.mkv', {
      removedAt: '2026-10-01T09:00:00Z',
    });
    const otherDevice = file('d4', 'E:\\Movies\\Heat.1995.mkv', { deviceId: 'desktop' });
    expect(
      filesInFolder('laptop', 'e:/movies', [inception, dune, removed, episode1, otherDevice]),
    ).toEqual([inception, dune]);
  });
});

describe('topSuggestionGroups', () => {
  it('groups files by their best candidate and skips files without one', () => {
    const inception = file('e1', 'E:\\Movies\\Inception.2010.mkv', {
      matchCandidates: [inceptionCandidate, duneCandidate],
    });
    const inception4k = file('e2', 'E:\\Movies\\Inception.2010.2160p.mkv', {
      matchCandidates: [inceptionCandidate],
    });
    const dune = file('e3', 'E:\\Movies\\Dune.2021.mkv', { matchCandidates: [duneCandidate] });
    const unknown = file('e4', 'E:\\Movies\\movie.mkv', { matchCandidates: [] });

    expect(topSuggestionGroups([inception, unknown, dune, inception4k])).toEqual({
      groups: [
        {
          ref: { provider: 'tmdb', externalId: 'movie:27205' },
          candidate: inceptionCandidate,
          files: [inception, inception4k],
        },
        {
          ref: { provider: 'tmdb', externalId: 'movie:438631' },
          candidate: duneCandidate,
          files: [dune],
        },
      ],
      skipped: [unknown],
    });
  });
});
