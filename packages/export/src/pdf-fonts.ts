// The PDF's fonts (FC-26). jsPDF's built-in fonts only cover Latin-1, so the app embeds Noto Sans
// (Latin, Greek, Cyrillic), plus Noto Sans SC (Chinese, Japanese) and Noto Sans KR (Korean) when the
// text needs them. jsPDF embeds only the glyphs a document uses. A font is picked per text run:
// jsPDF has no glyph fallback between fonts.

/** The font files, as TrueType bytes. Without them the PDF uses Helvetica (Latin-1 only). */
export interface PdfFonts {
  regular: Uint8Array;
  bold: Uint8Array;
  /** Noto Sans SC: Chinese characters and Japanese kana. */
  sc?: Uint8Array;
  /** Noto Sans KR: Hangul. */
  kr?: Uint8Array;
}

/** The fonts beyond Noto Sans a text needs. */
export interface FontNeeds {
  sc: boolean;
  kr: boolean;
}

/** jsPDF's names of the embedded fonts. */
export const PDF_FONT_NAMES = {
  latin: 'NotoSans',
  sc: 'NotoSansSC',
  kr: 'NotoSansKR',
  /** jsPDF's built-in fallback. */
  builtIn: 'helvetica',
} as const;
export type PdfFontName = (typeof PDF_FONT_NAMES)[keyof typeof PDF_FONT_NAMES];

const HANGUL = /\p{Script=Hangul}/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffef]/u;

/** Which CJK fonts some text needs. */
export function fontNeeds(texts: Iterable<string>): FontNeeds {
  const needs: FontNeeds = { sc: false, kr: false };
  for (const value of texts) {
    if (!needs.kr && HANGUL.test(value)) needs.kr = true;
    else if (!needs.sc && CJK.test(value)) needs.sc = true;
    if (needs.sc && needs.kr) break;
  }
  return needs;
}

/**
 * The font for a text run: Noto Sans KR for Hangul, Noto Sans SC for other CJK text (both also have
 * Latin letters), else Noto Sans. Helvetica when the fonts aren't loaded.
 */
export function fontFor(
  value: string,
  fonts: Partial<FontNeeds> & { latin: boolean },
): PdfFontName {
  if (fonts.kr && HANGUL.test(value)) return PDF_FONT_NAMES.kr;
  if (fonts.sc && CJK.test(value)) return PDF_FONT_NAMES.sc;
  return fonts.latin ? PDF_FONT_NAMES.latin : PDF_FONT_NAMES.builtIn;
}
