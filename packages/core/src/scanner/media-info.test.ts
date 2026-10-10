import { describe, expect, it } from 'vitest';

import {
  channelLayout,
  parseMediaInfo,
  resolutionFromDimensions,
  toCopyDetails,
} from './media-info';

import type { ParsedMedia } from './filename-parser';

const parsed: ParsedMedia = {
  kind: 'movie',
  title: 'Dune',
  year: 2021,
  resolution: '2160p',
  hdr: 'HDR10',
  audioChannels: '5.1',
  fileFormat: 'MKV',
  confidence: 0.9,
};

describe('parseMediaInfo', () => {
  it('keeps the valid fields of stored media info', () => {
    expect(
      parseMediaInfo({
        resolution: '2160p',
        hdr: 'Dolby Vision',
        audioLanguages: ['en'],
        hdr10: 1,
      }),
    ).toEqual({ resolution: '2160p', hdr: 'Dolby Vision', audioLanguages: ['en'] });
    expect(parseMediaInfo({ resolution: 2160, fileFormat: 'MKV' })).toEqual({ fileFormat: 'MKV' });
    expect(parseMediaInfo({})).toEqual({});
  });

  it('returns null for a file that has not been read', () => {
    expect(parseMediaInfo(null)).toBeNull();
  });
});

describe('resolutionFromDimensions', () => {
  it('classifies a frame size by either dimension', () => {
    expect(resolutionFromDimensions(3840, 2160)).toBe('2160p');
    expect(resolutionFromDimensions(1920, 800)).toBe('1080p');
    expect(resolutionFromDimensions(1440, 1080)).toBe('1080p');
    expect(resolutionFromDimensions(1280, 720)).toBe('720p');
    expect(resolutionFromDimensions(720, 576)).toBe('576p');
    expect(resolutionFromDimensions(720, 480)).toBe('480p');
  });
});

describe('channelLayout', () => {
  it('turns a channel count into a layout', () => {
    expect(channelLayout(2)).toBe('2.0');
    expect(channelLayout(6)).toBe('5.1');
    expect(channelLayout(8)).toBe('7.1');
  });

  it('uses the given LFE flag', () => {
    expect(channelLayout(6, false)).toBe('6.0');
    expect(channelLayout(3, true)).toBe('2.1');
  });
});

describe('toCopyDetails', () => {
  it('prefers the headers and fills the gaps from the name', () => {
    expect(
      toCopyDetails(parsed, { hdr: 'Dolby Vision', audioChannels: '7.1', audioLanguages: ['en'] }),
    ).toEqual({
      format: 'Digital file',
      details: {
        fileFormat: 'MKV',
        resolution: '2160p',
        hdr: 'Dolby Vision',
        audioChannels: '7.1',
        audioLanguages: ['en'],
      },
    });
  });

  it('uses only the name before the file is read', () => {
    expect(toCopyDetails(parsed, null)).toEqual({
      format: 'Digital file',
      details: { fileFormat: 'MKV', resolution: '2160p', hdr: 'HDR10', audioChannels: '5.1' },
    });
  });

  it('lists sidecar subtitle languages before embedded ones', () => {
    expect(
      toCopyDetails(parsed, { subtitleLanguages: ['en', 'de'] }, ['sr', 'en']).details
        .subtitleLanguages,
    ).toEqual(['sr', 'en', 'de']);
  });
});
