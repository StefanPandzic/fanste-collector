import { describe, expect, it } from 'vitest';

import { fontFor, fontNeeds } from './pdf-fonts';

describe('fontNeeds', () => {
  it('picks the CJK fonts the text needs', () => {
    expect(fontNeeds(['Inception', 'Amélie'])).toEqual({ sc: false, kr: false });
    expect(fontNeeds(['Inception', '千と千尋の神隠し'])).toEqual({ sc: true, kr: false });
    expect(fontNeeds(['기생충', 'Akira'])).toEqual({ sc: false, kr: true });
  });
});

describe('fontFor', () => {
  it('uses the font that has the glyphs of the text', () => {
    const fonts = { latin: true, sc: true, kr: true };
    expect(fontFor('Inception', fonts)).toBe('NotoSans');
    expect(fontFor('千と千尋の神隠し', fonts)).toBe('NotoSansSC');
    expect(fontFor('기생충', fonts)).toBe('NotoSansKR');
  });

  it('falls back to Helvetica without loaded fonts', () => {
    expect(fontFor('Inception', { latin: false })).toBe('helvetica');
  });
});
