import { describe, expect, it } from 'vitest';

import { parseMediaFilename } from './filename-parser';
import {
  fillEmptyDetails,
  groupForMatching,
  mergeSeasons,
  scannedCopyDetails,
  scannedCopyInput,
  scannedFileDetails,
} from './match-plan';

import type { MatchableFile, ParsedFile } from './match-plan';
import type { NormalizedItem } from '../models/normalized-item';

function file(id: string, filePath: string): MatchableFile {
  return { id, filePath, mediaInfo: null, subtitleLanguages: [] };
}

function parsedFile(id: string, filePath: string): ParsedFile {
  return { file: file(id, filePath), parsed: parseMediaFilename(filePath) };
}

const dune: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'movie:438631',
  category: 'movie',
  title: 'Dune',
  releaseYear: 2021,
  extra: { originalLanguage: 'en' },
};

const severance: NormalizedItem = {
  provider: 'tmdb',
  externalId: 'tv:95396',
  category: 'tv',
  title: 'Severance',
  releaseYear: 2022,
  extra: { seasons: [{ seasonNumber: 1, episodeCount: 9 }] },
};

const duneFiles = [
  parsedFile('3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70', 'E:\\Movies\\Dune.2021.1080p.BluRay.mkv'),
  parsedFile(
    '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
    'E:\\Movies\\Dune (2021)\\Dune.2021.2160p.UHD.BluRay.DV.mkv',
  ),
];

const severanceFiles = [
  parsedFile('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', 'F:\\Series\\Severance\\Severance.S01E01.mkv'),
  parsedFile('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', 'F:\\Series\\Severance\\Severance.S01E02.mkv'),
];

describe('groupForMatching', () => {
  it('groups files by kind, title and year and keeps unparsed files apart', () => {
    const inception = file('a1', 'E:\\Movies\\Inception (2010)\\Inception.mkv');
    const inception4k = file('a2', 'E:\\Movies\\Inception.2010.2160p.mkv');
    const episode1 = file('b1', 'F:\\Series\\Severance\\Severance.S01E01.mkv');
    const episode2 = file('b2', 'F:\\Series\\Severance\\Severance.S01E02.mkv');
    const unnamed = file('c1', 'C:\\Users\\stefan\\Videos\\movie.mkv');

    const { groups, unparsed } = groupForMatching([
      inception,
      episode1,
      unnamed,
      inception4k,
      episode2,
    ]);
    expect(groups.map((group) => group.query)).toEqual([
      { title: 'Inception', kind: 'movie', year: 2010 },
      { title: 'Severance', kind: 'tv' },
    ]);
    expect(groups.map((group) => group.files.map(({ file }) => file.id))).toEqual([
      ['a1', 'a2'],
      ['b1', 'b2'],
    ]);
    expect(unparsed).toEqual([unnamed]);
  });
});

describe('scannedCopyDetails', () => {
  it('takes the best-resolution version and the original language', () => {
    expect(scannedCopyDetails(dune, duneFiles)).toEqual({
      resolution: '2160p',
      hdr: 'Dolby Vision',
      fileFormat: 'MKV',
      audioLanguages: ['en'],
    });
  });

  it('turns scanned episodes into owned seasons', () => {
    expect(scannedCopyDetails(severance, severanceFiles).seasons).toEqual([
      { seasonNumber: 1, episodesOwned: [1, 2] },
    ]);
  });
});

describe('scannedFileDetails', () => {
  it('records the header values of the best version', () => {
    const dune1080p = parsedFile(
      '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
      'E:\\Movies\\Dune.2021.1080p.BluRay.mkv',
    );
    const dune4k = parsedFile(
      '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
      'E:\\Movies\\Dune (2021)\\Dune.2021.2160p.UHD.BluRay.DV.mkv',
    );
    const files: ParsedFile[] = [
      { ...dune1080p, file: { ...dune1080p.file, mediaInfo: { audioChannels: '5.1' } } },
      { ...dune4k, file: { ...dune4k.file, mediaInfo: { audioChannels: '7.1' } } },
    ];
    const written = scannedCopyDetails(dune, files);
    expect(written.audioChannels).toBe('7.1');
    expect(scannedFileDetails(files, written)).toEqual({ audioChannels: '7.1' });
  });
});

describe('scannedCopyInput', () => {
  it('builds an owned Digital file copy added by the scanner', () => {
    expect(scannedCopyInput(dune, duneFiles)).toEqual({
      category: 'movie',
      provider: 'tmdb',
      externalId: 'movie:438631',
      format: 'Digital file',
      ownership: 'owned',
      details: scannedCopyDetails(dune, duneFiles),
      source: 'scanner',
    });
  });
});

describe('mergeSeasons', () => {
  it('adds scanned episodes and seasons without removing any', () => {
    expect(
      mergeSeasons(
        [
          { seasonNumber: 1, episodesOwned: [1, 2] },
          { seasonNumber: 2, episodesOwned: 'all' },
        ],
        [
          { seasonNumber: 1, episodesOwned: [3] },
          { seasonNumber: 2, episodesOwned: [1] },
          { seasonNumber: 3, episodesOwned: [1] },
        ],
      ),
    ).toEqual([
      { seasonNumber: 1, episodesOwned: [1, 2, 3] },
      { seasonNumber: 2, episodesOwned: 'all' },
      { seasonNumber: 3, episodesOwned: [1] },
    ]);
  });
});

describe('fillEmptyDetails', () => {
  it('fills only the empty fields of a copy', () => {
    const current = { resolution: '1080p', edition: 'Steelbook' };
    expect(
      fillEmptyDetails('movie', current, { resolution: '2160p', hdr: 'HDR10', fileFormat: 'MKV' }),
    ).toEqual({ hdr: 'HDR10', fileFormat: 'MKV' });
    expect(fillEmptyDetails('movie', current, { resolution: '2160p' })).toEqual({});
  });

  it('adds newly scanned episodes to the owned seasons', () => {
    expect(
      fillEmptyDetails(
        'tv',
        { seasons: [{ seasonNumber: 1, episodesOwned: [1] }] },
        { seasons: [{ seasonNumber: 1, episodesOwned: [2] }] },
      ),
    ).toEqual({ seasons: [{ seasonNumber: 1, episodesOwned: [1, 2] }] });
  });
});
