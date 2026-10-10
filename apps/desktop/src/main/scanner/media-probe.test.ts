import { describe, expect, it } from 'vitest';

import { toMediaInfo } from './media-probe';

import type { MediaInfoResult, Track } from 'mediainfo.js';

function result(...track: Track[]): MediaInfoResult {
  return { media: { '@ref': 'E:\\Movies\\Dune (2021)\\Dune.mkv', track } };
}

const uhdVideo: Track = { '@type': 'Video', Width: 3840, Height: 2160 };

describe('toMediaInfo', () => {
  it('reads the container, resolution, HDR, audio and languages', () => {
    expect(
      toMediaInfo(
        result(
          { '@type': 'General', Format: 'Matroska' },
          { ...uhdVideo, HDR_Format: 'Dolby Vision, SMPTE ST 2086' },
          { '@type': 'Audio', Channels: 2, Language: 'sr' },
          {
            '@type': 'Audio',
            Channels: 6,
            ChannelLayout: 'L R C LFE Ls Rs',
            Default: 'Yes',
            Language: 'en',
          },
          { '@type': 'Text', Language: 'en' },
          { '@type': 'Text', Language: 'srp' },
        ),
        '.mkv',
      ),
    ).toEqual({
      fileFormat: 'MKV',
      resolution: '2160p',
      hdr: 'Dolby Vision',
      audioChannels: '5.1',
      audioLanguages: ['en', 'sr'],
      subtitleLanguages: ['en', 'sr'],
    });
  });

  it('picks the MPEG-4 format from the extension or profile', () => {
    expect(toMediaInfo(result({ '@type': 'General', Format: 'MPEG-4' }), '.m4v').fileFormat).toBe(
      'M4V',
    );
    expect(
      toMediaInfo(
        result({ '@type': 'General', Format: 'MPEG-4', Format_Profile: 'QuickTime' }),
        '.qt',
      ).fileFormat,
    ).toBe('MOV');
  });

  it('tells the HDR format of the video track', () => {
    const hdrOf = (HDR_Format?: string) =>
      toMediaInfo(result({ ...uhdVideo, HDR_Format }), '.mkv').hdr;
    expect(hdrOf('SMPTE ST 2094 App 4, SMPTE ST 2086')).toBe('HDR10+');
    expect(hdrOf('SMPTE ST 2086')).toBe('HDR10');
    expect(hdrOf(undefined)).toBe('none');
    expect(toMediaInfo({}, '.mkv')).toEqual({});
  });
});
