import { describe, expect, it } from 'vitest';

import { coverBlurDataUrl } from './cover-placeholder';

const prefix = 'data:image/svg+xml;base64,';

describe('coverBlurDataUrl', () => {
  it('returns a base64 SVG tinted with the category color', () => {
    const url = coverBlurDataUrl('movie');
    expect(url.startsWith(prefix)).toBe(true);

    const svg = atob(url.slice(prefix.length));
    expect(svg).toContain('<svg');
    expect(svg).toContain('#c9222b');
    expect(atob(coverBlurDataUrl('video_game').slice(prefix.length))).toContain('#0a7e3a');
  });

  it('differs between categories', () => {
    expect(coverBlurDataUrl('movie')).not.toBe(coverBlurDataUrl('music'));
  });
});
