import { describe, expect, it } from 'vitest';

import {
  baseName,
  fileExtension,
  isCollectedVideo,
  isSampleOrTrailer,
  isSkippedDirectory,
  megabytesToBytes,
} from './scan-rules';

const minSize = 50 * 1024 * 1024;

describe('fileExtension / baseName', () => {
  it('splits a file name at its last dot', () => {
    expect(fileExtension('Inception.2010.1080p.MKV')).toBe('.mkv');
    expect(baseName('Inception.2010.1080p.MKV')).toBe('Inception.2010.1080p');
    expect(fileExtension('README')).toBe('');
    expect(baseName('README')).toBe('README');
  });
});

describe('isSkippedDirectory', () => {
  it('skips hidden, system and extras folders', () => {
    expect(isSkippedDirectory('.Trashes')).toBe(true);
    expect(isSkippedDirectory('$RECYCLE.BIN')).toBe(true);
    expect(isSkippedDirectory('System Volume Information')).toBe(true);
    expect(isSkippedDirectory('@eaDir')).toBe(true);
    expect(isSkippedDirectory('Samples')).toBe(true);
  });

  it('enters library folders', () => {
    expect(isSkippedDirectory('Inception (2010)')).toBe(false);
    expect(isSkippedDirectory('Season 01')).toBe(false);
  });
});

describe('isSampleOrTrailer', () => {
  it('recognizes samples and trailers', () => {
    expect(isSampleOrTrailer('inception-sample.mkv')).toBe(true);
    expect(isSampleOrTrailer('Sample.mkv')).toBe(true);
    expect(isSampleOrTrailer('Inception-trailer.mp4')).toBe(true);
    expect(isSampleOrTrailer('Inception.2010.1080p.mkv')).toBe(false);
  });
});

describe('isCollectedVideo', () => {
  it('collects big enough video files', () => {
    expect(isCollectedVideo('Inception.2010.mkv', minSize, minSize)).toBe(true);
    expect(isCollectedVideo('Dune.2021.MP4', minSize * 20, minSize)).toBe(true);
  });

  it('skips small, hidden, sample and non-video files', () => {
    expect(isCollectedVideo('Inception.2010.mkv', minSize - 1, minSize)).toBe(false);
    expect(isCollectedVideo('._Inception.2010.mkv', minSize, minSize)).toBe(false);
    expect(isCollectedVideo('inception-sample.mkv', minSize, minSize)).toBe(false);
    expect(isCollectedVideo('Inception.2010.nfo', minSize, minSize)).toBe(false);
  });
});

describe('megabytesToBytes', () => {
  it('converts megabytes to bytes', () => {
    expect(megabytesToBytes(50)).toBe(52_428_800);
    expect(megabytesToBytes(0.5)).toBe(524_288);
  });
});
