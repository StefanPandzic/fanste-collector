import { describe, expect, it } from 'vitest';

import { coverFetchUrl, isProxiedImageUrl } from './image-proxy';

const discogsCover =
  'https://i.discogs.com/Zk3d9pQ/rs:fit/g:sm/q:90/h:600/w:600/R-2607424-1288530830.jpeg';
const bggCover = 'https://cf.geekdo-images.com/x3zxjr-Vw5iU4yDPg70Jgw__original/pic3490053.jpg';
const tmdbCover = 'https://image.tmdb.org/t/p/w185/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg';

describe('isProxiedImageUrl', () => {
  it('accepts https covers on the Discogs and BoardGameGeek image hosts', () => {
    expect(isProxiedImageUrl(discogsCover)).toBe(true);
    expect(isProxiedImageUrl(bggCover)).toBe(true);
  });

  it('rejects other hosts, http, ports and credentials', () => {
    expect(isProxiedImageUrl(tmdbCover)).toBe(false);
    expect(isProxiedImageUrl('http://i.discogs.com/R-2607424.jpeg')).toBe(false);
    expect(isProxiedImageUrl('https://i.discogs.com:8443/R-2607424.jpeg')).toBe(false);
    expect(isProxiedImageUrl('https://user:secret@i.discogs.com/R-2607424.jpeg')).toBe(false);
  });
});

describe('coverFetchUrl', () => {
  it('loads proxied covers through the gateway and others directly', () => {
    expect(coverFetchUrl(discogsCover)).toBe(`/api/image?url=${encodeURIComponent(discogsCover)}`);
    expect(coverFetchUrl(tmdbCover)).toBe(tmdbCover);
  });
});
