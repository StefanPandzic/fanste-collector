import { LANGUAGE_CODES } from '../models/copy-options';

/** Sidecar subtitle formats the scanner collects next to a video (FC-21). */
export const SUBTITLE_EXTENSIONS: readonly string[] = [
  '.srt',
  '.ass',
  '.ssa',
  '.sub',
  '.idx',
  '.vtt',
];

/** ISO 639-2 codes (both the B and T forms) of the app's languages, mapped to ISO 639-1. */
const ISO_639_2: Readonly<Record<string, string>> = {
  eng: 'en',
  srp: 'sr',
  scc: 'sr',
  hrv: 'hr',
  scr: 'hr',
  bos: 'bs',
  slv: 'sl',
  mkd: 'mk',
  mac: 'mk',
  deu: 'de',
  ger: 'de',
  fra: 'fr',
  fre: 'fr',
  spa: 'es',
  ita: 'it',
  por: 'pt',
  nld: 'nl',
  dut: 'nl',
  swe: 'sv',
  nor: 'no',
  nob: 'no',
  dan: 'da',
  fin: 'fi',
  isl: 'is',
  ice: 'is',
  pol: 'pl',
  ces: 'cs',
  cze: 'cs',
  slk: 'sk',
  slo: 'sk',
  hun: 'hu',
  ron: 'ro',
  rum: 'ro',
  bul: 'bg',
  ell: 'el',
  gre: 'el',
  tur: 'tr',
  rus: 'ru',
  ukr: 'uk',
  jpn: 'ja',
  kor: 'ko',
  zho: 'zh',
  chi: 'zh',
  hin: 'hi',
  ara: 'ar',
  heb: 'he',
  fas: 'fa',
  per: 'fa',
  tha: 'th',
  vie: 'vi',
  ind: 'id',
};

const TWO_LETTER: ReadonlySet<string> = new Set(LANGUAGE_CODES);

let languageNames: ReadonlyMap<string, string> | undefined;

/** English language names (`english`, `serbian`, …) of the app's languages, built once. */
function nameToCode(): ReadonlyMap<string, string> {
  if (!languageNames) {
    const display = new Intl.DisplayNames(['en'], { type: 'language' });
    languageNames = new Map(
      LANGUAGE_CODES.map((code) => [(display.of(code) ?? code).toLowerCase(), code]),
    );
  }
  return languageNames;
}

/**
 * The app's ISO 639-1 code (`LANGUAGE_CODES`) for a language token: `en`, `eng`, `English`, or a
 * tag like `en-US`. `undefined` for other languages and for `und`.
 */
export function toLanguageCode(token: string): string | undefined {
  const lower = token.trim().toLowerCase().split('-')[0] ?? '';
  if (lower.length === 2) return TWO_LETTER.has(lower) ? lower : undefined;
  if (lower.length === 3) return ISO_639_2[lower];
  return nameToCode().get(lower);
}

function splitExtension(fileName: string): [base: string, extension: string] {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? [fileName.slice(0, dot), fileName.slice(dot).toLowerCase()] : [fileName, ''];
}

/** `true` if the file name has a {@link SUBTITLE_EXTENSIONS} extension. */
export function isSubtitleFile(fileName: string): boolean {
  return SUBTITLE_EXTENSIONS.includes(splitExtension(fileName)[1]);
}

/**
 * Matches a subtitle file to the video in the same folder. `Movie.srt`, `Movie.en.srt` and
 * `Movie.srp.forced.srt` belong to `Movie.mkv`; `Other.en.srt` doesn't.
 *
 * @param subtitleFileName The subtitle's file name, e.g. `Movie.en.srt`.
 * @param videoBaseName The video's file name without its extension, e.g. `Movie`.
 * @returns `undefined` if the subtitle isn't the video's; otherwise its language (the first token
 *   that is one, e.g. `sr` for `srp`), or `null` when the name has none.
 */
export function subtitleLanguage(
  subtitleFileName: string,
  videoBaseName: string,
): string | null | undefined {
  const [base, extension] = splitExtension(subtitleFileName);
  if (!SUBTITLE_EXTENSIONS.includes(extension)) return undefined;
  const video = videoBaseName.toLowerCase();
  const lower = base.toLowerCase();
  if (lower === video) return null;
  if (!lower.startsWith(video) || !/^[._\- ]/.test(lower.slice(video.length))) return undefined;

  const tokens = base.slice(video.length).split(/[._\- ]+/);
  for (const token of tokens) {
    const code = token && toLanguageCode(token);
    if (code) return code;
  }
  return null;
}
