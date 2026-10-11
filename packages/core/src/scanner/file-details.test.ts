import { describe, expect, it } from 'vitest';

import {
  FILE_DETAIL_FIELDS,
  fileDetailOrigin,
  headerDetails,
  parseFileDetails,
  versionsByQuality,
} from './file-details';
import { parseMediaFilename } from './filename-parser';

import type { MatchableFile } from './match-plan';

const inception4k: MatchableFile = {
  id: '3f6c1e2a-8b4d-4c5e-9f7a-2b3c4d5e6f70',
  filePath: 'E:\\Movies\\Inception (2010)\\Inception.2010.2160p.HDR.mkv',
  mediaInfo: { audioChannels: '7.1', audioLanguages: ['en'] },
  subtitleLanguages: ['en', 'sr'],
};

const inception1080p: MatchableFile = {
  id: '5b1f0c2e-7d3a-4e8b-9c6f-1a2b3c4d5e6f',
  filePath: 'E:\\Movies\\Inception (2010)\\Inception.2010.1080p.BluRay.mkv',
  mediaInfo: null,
  subtitleLanguages: [],
};

describe('FILE_DETAIL_FIELDS', () => {
  it('lists the fields a file header can tell', () => {
    expect(FILE_DETAIL_FIELDS).toContain('resolution');
    expect(FILE_DETAIL_FIELDS).toContain('audioLanguages');
    expect(FILE_DETAIL_FIELDS).toContain('subtitleLanguages');
  });
});

describe('parseFileDetails', () => {
  it('keeps the valid fields', () => {
    expect(
      parseFileDetails({ resolution: '2160p', audioChannels: '5.1', edition: 'Steelbook' }),
    ).toEqual({ resolution: '2160p', audioChannels: '5.1' });
  });
});

describe('versionsByQuality', () => {
  it('puts the highest resolution first', () => {
    const versions = versionsByQuality(
      [inception1080p, inception4k].map((file) => ({
        file,
        parsed: parseMediaFilename(file.filePath),
      })),
    );
    expect(versions.map(({ file }) => file.file.id)).toEqual([inception4k.id, inception1080p.id]);
    expect(versions.map(({ details }) => details.resolution)).toEqual(['2160p', '1080p']);
  });
});

describe('headerDetails', () => {
  it('records only the written values the headers say', () => {
    expect(
      headerDetails(
        {
          resolution: '2160p',
          fileFormat: 'MKV',
          audioChannels: '7.1',
          audioLanguages: ['en'],
          subtitleLanguages: ['sr', 'en'],
        },
        {
          resolution: '2160p',
          audioChannels: '7.1',
          audioLanguages: ['en'],
          subtitleLanguages: ['en'],
        },
      ),
    ).toEqual({ resolution: '2160p', audioChannels: '7.1', audioLanguages: ['en'] });
  });

  it('records nothing when the file was not read', () => {
    expect(headerDetails({ resolution: '2160p' }, null)).toEqual({});
  });
});

describe('fileDetailOrigin', () => {
  it('compares the stored value with the recorded one', () => {
    expect(fileDetailOrigin('2160p', '2160p')).toBe('file');
    expect(fileDetailOrigin(['en'], ['en'])).toBe('file');
    expect(fileDetailOrigin('1080p', '2160p')).toBe('edited');
    expect(fileDetailOrigin(undefined, '2160p')).toBe('edited');
    expect(fileDetailOrigin('2160p', undefined)).toBeUndefined();
  });
});
