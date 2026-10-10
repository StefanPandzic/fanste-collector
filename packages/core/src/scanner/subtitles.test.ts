import { describe, expect, it } from 'vitest';

import { isSubtitleFile, subtitleLanguage } from './subtitles';

describe('isSubtitleFile', () => {
  it('recognizes sidecar subtitle formats', () => {
    expect(isSubtitleFile('Inception.2010.en.srt')).toBe(true);
    expect(isSubtitleFile('Inception.2010.ASS')).toBe(true);
    expect(isSubtitleFile('Inception.2010.mkv')).toBe(false);
    expect(isSubtitleFile('Inception.2010.nfo')).toBe(false);
  });
});

describe('subtitleLanguage', () => {
  it('reads the language of a subtitle that belongs to the video', () => {
    expect(subtitleLanguage('Movie.en.srt', 'Movie')).toBe('en');
    expect(subtitleLanguage('Movie.srp.forced.srt', 'Movie')).toBe('sr');
    expect(subtitleLanguage('Movie.English.srt', 'Movie')).toBe('en');
  });

  it('returns null for a subtitle of the video without a language', () => {
    expect(subtitleLanguage('Movie.srt', 'Movie')).toBeNull();
    expect(subtitleLanguage('Movie.forced.srt', 'Movie')).toBeNull();
  });

  it('returns undefined for a subtitle of another video', () => {
    expect(subtitleLanguage('Other.en.srt', 'Movie')).toBeUndefined();
    expect(subtitleLanguage('Movie2.en.srt', 'Movie')).toBeUndefined();
  });
});
