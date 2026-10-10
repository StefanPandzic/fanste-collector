import { describe, expect, it } from 'vitest';

import { isPathInside, toPathKey } from './paths';

describe('toPathKey', () => {
  it('lowercases and uses forward slashes on Windows', () => {
    expect(toPathKey('E:\\Movies\\Inception (2010)\\Inception.mkv', 'windows')).toBe(
      'e:/movies/inception (2010)/inception.mkv',
    );
    expect(toPathKey('E:\\Movies\\', 'windows')).toBe('e:/movies');
    expect(toPathKey('\\\\NAS\\Media\\Movies', 'windows')).toBe('//nas/media/movies');
  });

  it('lowercases on macOS and keeps the case on Linux', () => {
    expect(toPathKey('/Volumes/Media/Movies/', 'macos')).toBe('/volumes/media/movies');
    expect(toPathKey('/mnt/Media/Movies/', 'linux')).toBe('/mnt/Media/Movies');
  });
});

describe('isPathInside', () => {
  it('accepts the folder itself and paths inside it', () => {
    expect(isPathInside('e:/movies', 'e:/movies')).toBe(true);
    expect(isPathInside('e:/movies/inception/inception.mkv', 'e:/movies')).toBe(true);
    expect(isPathInside('e:/movies/inception.mkv', 'e:/')).toBe(true);
  });

  it('rejects sibling folders with the same prefix', () => {
    expect(isPathInside('e:/movies-4k/dune.mkv', 'e:/movies')).toBe(false);
    expect(isPathInside('d:/movies/dune.mkv', 'e:/movies')).toBe(false);
  });
});
