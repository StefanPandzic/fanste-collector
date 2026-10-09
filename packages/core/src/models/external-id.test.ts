import { describe, expect, it } from 'vitest';

import { isValidExternalId } from './external-id';

describe('isValidExternalId', () => {
  it('accepts the ID format of each provider', () => {
    expect(isValidExternalId('tmdb', 'movie', 'movie:603')).toBe(true);
    expect(isValidExternalId('tmdb', 'tv', 'tv:1396')).toBe(true);
    expect(isValidExternalId('discogs', 'music', 'release:249504')).toBe(true);
    expect(isValidExternalId('discogs', 'music', 'master:33013')).toBe(true);
    expect(isValidExternalId('igdb', 'video_game', '1942')).toBe(true);
    expect(isValidExternalId('bgg', 'board_game', '174430')).toBe(true);
  });

  it('rejects TMDB IDs whose prefix does not match the category', () => {
    expect(isValidExternalId('tmdb', 'movie', 'tv:1396')).toBe(false);
    expect(isValidExternalId('tmdb', 'tv', 'movie:603')).toBe(false);
    expect(isValidExternalId('tmdb', 'movie', '603')).toBe(false);
  });

  it('rejects every ID for custom items', () => {
    expect(isValidExternalId('custom', 'funko', '123')).toBe(false);
  });
});
