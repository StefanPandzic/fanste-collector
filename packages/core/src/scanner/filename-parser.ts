// Filename parser (FC-22): the likely title, year, TV episode and quality of a video file, read from
// its file and folder names, e.g. `Inception.2010.1080p.mkv` → Inception (2010), 1080p, MKV. Pure
// (no Node APIs), so the desktop scanner, the web app and a future mobile app can all use it.

/** What the parser reads from a video file's path. */
export interface ParsedMedia {
  /** `tv` when an episode marker was found; `movie` when a year was found; otherwise `unknown`. */
  kind: 'movie' | 'tv' | 'unknown';
  /** The movie or series title, or `null` when the names hold none. */
  title: string | null;
  year?: number;
  season?: number;
  episode?: number;
  resolution?: '480p' | '576p' | '720p' | '1080p' | '2160p';
  hdr?: 'HDR10' | 'HDR10+' | 'Dolby Vision';
  /** e.g. `BluRay`, `WEB-DL`, `DVDRip`, `REMUX`. */
  source?: string;
  /** e.g. `5.1`, from `DD5.1`, `DDP5.1`, `AAC2.0`, `TrueHD.7.1`. */
  audioChannels?: string;
  /** From the extension (`MKV`, `MP4`, …), or `ISO` / `VIDEO_TS` / `BDMV` for disc images. */
  fileFormat?: string;
  /** 0–1, how sure the parser is about the title (and year). */
  confidence: number;
}

export interface ParseMediaOptions {
  /** Years after this aren't release years (`Blade Runner 2049`). Defaults to next year. */
  maxYear?: number;
}

const MIN_YEAR = 1900;

/** Extensions the parser strips, with the file format each one means. */
const FILE_FORMATS: Readonly<Record<string, string>> = {
  mkv: 'MKV',
  mp4: 'MP4',
  avi: 'AVI',
  mov: 'MOV',
  m4v: 'M4V',
  wmv: 'WMV',
  ts: 'TS',
  m2ts: 'M2TS',
  mts: 'M2TS',
  webm: 'WebM',
  iso: 'ISO',
  mpg: 'MPG',
  mpeg: 'MPG',
  vob: 'VOB',
};

/** Folders of a disc's file structure, which also give the file format. */
const DISC_FOLDERS: Readonly<Record<string, string>> = {
  video_ts: 'VIDEO_TS',
  bdmv: 'BDMV',
};

/** Names that say nothing about the title, so the parent folder's name is used instead. */
const GENERIC_NAME =
  /^(?:movie|film|video|feature|main|title|cd ?\d+|dis[ck] ?\d+|part ?\d+|pt ?\d+|video ts|vts \d+ \d+|bdmv|stream|playlist|backup|certificate|0\d*|\d{5,})$/i;

/** Folders that only group files: they never hold the title. */
const GROUPING_FOLDER =
  /^(?:[a-z]:|video ts|bdmv|stream|playlist|backup|certificate|cd ?\d+|dis[ck] ?\d+|part ?\d+|specials?|extras?|featurettes?|movies?|films?|tv|tv shows?|series|shows?|videos?|media|downloads?|desktop|documents|volumes|mnt|complete|season ?\d+|series ?\d+|s ?\d{1,2})$/i;

/** A season folder, e.g. `Season 1`, `Series 02`, `S01`. */
const SEASON_FOLDER = /^(?:season|series|s) ?(\d{1,2})$/i;

/** Edition and release words that end a title (they come after it in release names). */
const RELEASE_WORDS: ReadonlySet<string> = new Set([
  'proper',
  'repack',
  'rerip',
  'internal',
  'limited',
  'extended',
  'unrated',
  'uncut',
  'remastered',
  'theatrical',
  'imax',
  'multi',
  'multisubs',
  'dual',
  'dubbed',
  'subbed',
  'complete',
  'readnfo',
  'nfofix',
  'hc',
  'criterion',
]);

/** Codec, audio and other quality tokens (compared lowercased). */
const QUALITY_WORDS: ReadonlySet<string> = new Set([
  'x264',
  'x265',
  'h264',
  'h265',
  'hevc',
  'avc',
  'xvid',
  'divx',
  'av1',
  'vp9',
  'mpeg2',
  'vc1',
  '10bit',
  '8bit',
  'hi10p',
  'aac',
  'ac3',
  'eac3',
  'dd',
  'ddp',
  'dts',
  'dtshd',
  'truehd',
  'atmos',
  'flac',
  'opus',
  'mp3',
  'lpcm',
  'pcm',
  'hdr',
  'hdr10',
  'hdr10+',
  'hdr10plus',
  'dv',
  'dovi',
  'sdr',
  'uhd',
  '4k',
  'bluray',
  'blu',
  'bdrip',
  'brrip',
  'bd25',
  'bd50',
  'remux',
  'webdl',
  'webrip',
  'web',
  'hdtv',
  'pdtv',
  'dvdrip',
  'dvd',
  'dvdr',
  'dvd5',
  'dvd9',
  'hdrip',
  'amzn',
  'nf',
  'dsnp',
  'hmax',
  'atvp',
  'hulu',
]);

const RESOLUTION_PATTERNS: readonly [RegExp, NonNullable<ParsedMedia['resolution']>][] = [
  [/\b(?:2160[pi]|4k|uhd|3840x2160|4096x2160)\b/, '2160p'],
  [/\b(?:1080[pi]|1920x\d{3,4})\b/, '1080p'],
  [/\b(?:720p|1280x\d{3})\b/, '720p'],
  [/\b576[pi]\b/, '576p'],
  [/\b480[pi]\b/, '480p'],
];

/** Sources, highest priority first (`BluRay REMUX` is a REMUX). */
const SOURCE_PATTERNS: readonly [RegExp, string][] = [
  [/\bremux\b/, 'REMUX'],
  [/\b(?:bdrip|brrip)\b/, 'BDRip'],
  [/\b(?:blu[ -]?ray|bd25|bd50)\b/, 'BluRay'],
  [/\bweb[ -]?dl\b/, 'WEB-DL'],
  [/\bwebrip\b/, 'WEBRip'],
  [/\bweb\b/, 'WEB'],
  [/\bhdtv\b/, 'HDTV'],
  [/\bdvdrip\b/, 'DVDRip'],
  [/\bdvd(?:r|5|9)?\b/, 'DVD'],
  [/\bhdrip\b/, 'HDRip'],
];

/** Audio codecs that may carry a channel layout right after them (`DDP5.1`, `TrueHD.7.1`). */
const AUDIO_CHANNELS =
  /(?:^|[^a-z0-9])(?:dd\+?|ddp|e-?ac-?3|ac-?3|aac|dts(?:[ .-]?hd)?(?:[ .-]?(?:ma|hra|x|es))?|truehd|atmos|flac|opus|l?pcm)(?:[ ._-]?atmos)?[ ._-]?([1-7])[ ._]([01])(?![0-9])/i;
/** A bare channel layout (`5.1`), only trusted after the first quality token. */
const BARE_CHANNELS = /(?:^|[ ._-])([2567])[ ._]([01])(?![0-9])/;

/** An episode marker: `S01E02`, `s1e2`, `S01E02E03`, `S01 E02`, `1x02`. */
const EPISODE_MARKERS: readonly RegExp[] = [
  /\bs(\d{1,2}) ?e(\d{1,3})(?:-?e?\d{1,3})*\b/i,
  /\b(\d{1,2})x(\d{2,3})\b/i,
  /\bseason (\d{1,2}),? episode (\d{1,3})\b/i,
];
/** An episode without its season: `E05`, `Ep 05`, `Episode 5`. */
const EPISODE_ONLY = /\b(?:e|ep|episode) ?(\d{1,3})\b/i;

interface NameInfo {
  title: string | null;
  year?: number;
  season?: number;
  episode?: number;
  resolution?: ParsedMedia['resolution'];
  hdr?: ParsedMedia['hdr'];
  source?: string;
  audioChannels?: string;
  /** A quality or release token was found (the name looks like a release name). */
  hasQuality: boolean;
}

/** Path segments, split on `/` and `\`, without empty ones. */
function pathSegments(path: string): string[] {
  return path.split(/[\\/]+/).filter((segment) => segment.length > 0);
}

/** `[base, format]`: the name without a known video extension, and that extension's file format. */
function splitKnownExtension(fileName: string): [string, string | undefined] {
  const match = /\.([a-z0-9]{2,4})$/i.exec(fileName);
  const format = match?.[1] && FILE_FORMATS[match[1].toLowerCase()];
  return format ? [fileName.slice(0, -match[0].length), format] : [fileName, undefined];
}

/** The name with `.`, `_` and loose `-` as spaces, bracket groups dropped and spaces collapsed. */
function normalizeName(name: string): string {
  return (
    name
      // `[GROUP]`, `{tags}`: release groups and site tags, never the title.
      .replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ')
      .replace(/[._]+/g, ' ')
      // A hyphen joining two letters stays (`Spider-Man`); other hyphens separate.
      .replace(/(?<!\p{L})-|-(?!\p{L})/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** A release year token: `2010`, `(2010)`, between 1900 and `maxYear`. */
function yearOf(token: string, maxYear: number): number | undefined {
  const match = /^\(?((?:19|20)\d{2})\)?$/.exec(token);
  if (!match?.[1]) return undefined;
  const year = Number(match[1]);
  return year >= MIN_YEAR && year <= maxYear ? year : undefined;
}

function isQualityToken(token: string): boolean {
  const lower = token.toLowerCase().replace(/[()-]/g, '');
  return (
    QUALITY_WORDS.has(lower) ||
    RELEASE_WORDS.has(lower) ||
    /^(?:\d{3,4}[pi]|\d{3,4}x\d{3,4})$/.test(lower) ||
    /^(?:ddp?|aac|ac3|eac3|dts|truehd|flac)\d/.test(lower) ||
    /^[hx]\d{3}$/.test(lower)
  );
}

/** `true` for `www`-style site prefixes, e.g. `www.Torrenting.com - Movie`. */
function isSiteToken(token: string): boolean {
  return /^(?:www|com|org|net|to|me|tv|cc|io)$/i.test(token);
}

function detectResolution(lower: string): ParsedMedia['resolution'] {
  return RESOLUTION_PATTERNS.find(([pattern]) => pattern.test(lower))?.[1];
}

function detectHdr(lower: string): ParsedMedia['hdr'] {
  if (/\b(?:dv|dovi|dolby ?vision)\b/.test(lower)) return 'Dolby Vision';
  if (/\bhdr10(?:\+|plus)/.test(lower)) return 'HDR10+';
  if (/\bhdr(?:10)?\b/.test(lower)) return 'HDR10';
  return undefined;
}

function detectSource(lower: string): string | undefined {
  return SOURCE_PATTERNS.find(([pattern]) => pattern.test(lower))?.[1];
}

/** `5.1` from `DDP5.1`; a bare `5.1` counts only in `tail` (the part after the title). */
function detectAudioChannels(raw: string, tail: string): string | undefined {
  const match = AUDIO_CHANNELS.exec(raw) ?? BARE_CHANNELS.exec(tail);
  return match ? `${match[1]}.${match[2]}` : undefined;
}

/** The title words, without parentheses and leftover separators. */
function cleanTitle(tokens: readonly string[]): string | null {
  const title = tokens
    .map((token) => token.replace(/[()]/g, ''))
    .filter((token) => token.length > 0 && token !== '-')
    .join(' ')
    .replace(/\s+-$/, '')
    .trim();
  return title.length > 0 ? title : null;
}

/** Reads one file or folder name (without its extension). */
function analyzeName(name: string, maxYear: number): NameInfo {
  const normalized = normalizeName(name);
  const tokens = normalized.split(' ').filter((token) => token.length > 0);

  // Leading site tags (`www Site com -`) are dropped.
  let start = 0;
  if (tokens[0]?.toLowerCase() === 'www') {
    const end = tokens.findIndex((token, index) => index > 0 && isSiteToken(token));
    if (end > 0) start = end + 1;
  }

  // Where the title ends: an episode marker, a release year, or the first quality token.
  let markerIndex = tokens.length;
  let season: number | undefined;
  let episode: number | undefined;
  for (const pattern of EPISODE_MARKERS) {
    const match = pattern.exec(normalized);
    if (!match?.[1] || !match[2]) continue;
    season = Number(match[1]);
    episode = Number(match[2]);
    // The token where the marker starts (`S01E02`, or `Season` of `Season 1 Episode 2`).
    const before = normalized.slice(0, match.index).trim();
    markerIndex = before.length === 0 ? 0 : before.split(' ').length;
    break;
  }

  let qualityIndex = tokens.length;
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token !== undefined && isQualityToken(token)) {
      // A first word like `Extended` or `DV` is part of the title, not a tag.
      if (index === start) continue;
      qualityIndex = index;
      break;
    }
  }

  const limit = Math.min(markerIndex, qualityIndex);
  // The last plausible year before the limit, but never the first word (`2012`, `1917 (2019)`).
  let yearIndex = -1;
  let year: number | undefined;
  for (let index = start + 1; index < limit; index += 1) {
    const found = yearOf(tokens[index] ?? '', maxYear);
    if (found !== undefined) {
      yearIndex = index;
      year = found;
    }
  }
  const titleEnd = yearIndex >= 0 ? yearIndex : limit;
  const tailStart = Math.min(titleEnd, qualityIndex);
  const tail = ` ${tokens.slice(tailStart).join(' ').toLowerCase()} `;

  return {
    title: cleanTitle(tokens.slice(start, titleEnd)),
    ...(year !== undefined ? { year } : {}),
    ...(season !== undefined ? { season } : {}),
    ...(episode !== undefined ? { episode } : {}),
    ...defined('resolution', detectResolution(tail)),
    ...defined('hdr', detectHdr(tail)),
    ...defined('source', detectSource(tail)),
    ...defined('audioChannels', detectAudioChannels(name, tail)),
    hasQuality: qualityIndex < tokens.length,
  };
}

/** `{ [key]: value }`, or `{}` when the value is `undefined` (for optional properties). */
function defined<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return value === undefined ? {} : ({ [key]: value } as { [P in K]?: V });
}

/** Lowercased letters and digits only, for comparing titles. */
function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** `true` if the two titles name the same thing (`Inception` and `Inception (2010)`). */
function sameTitle(a: string, b: string): boolean {
  const keyA = titleKey(a);
  const keyB = titleKey(b);
  return keyA.length > 0 && (keyA === keyB || keyA.startsWith(keyB) || keyB.startsWith(keyA));
}

/**
 * Parses a video file's path: the title, year, TV season and episode, and the quality tokens of a
 * release name. When the file name says nothing about the title (`movie.mkv`, `CD1`, `VIDEO_TS`,
 * `S01E02.mkv`), the nearest folder that isn't just a grouping folder (`Season 1`, `BDMV`, `CD1`)
 * gives it; a folder like `Inception (2010)` also gives the year of `Inception.mkv`.
 *
 * Works with `/` and `\` paths and with bare file names.
 */
export function parseMediaFilename(path: string, options: ParseMediaOptions = {}): ParsedMedia {
  const maxYear = options.maxYear ?? new Date().getFullYear() + 1;
  const segments = pathSegments(path);
  const fileName = segments.at(-1) ?? '';
  const allFolders = segments.slice(0, -1);
  // A user's home (`/Users/stefan`, `C:\Users\stefan`, `/home/stefan`) never names a title.
  // Only at the root (after a drive letter), so a movie folder named `Home` still counts.
  const home = allFolders.findIndex(
    (folder, index) =>
      (index === 0 || (index === 1 && /^[a-z]:$/i.test(allFolders[0] ?? ''))) &&
      /^(?:users|home)$/i.test(folder),
  );
  const folders = home >= 0 ? allFolders.slice(home + 2) : allFolders;
  const [base, extensionFormat] = splitKnownExtension(fileName);

  const discFolder = folders.find((folder) => DISC_FOLDERS[folder.toLowerCase()]);
  const fileFormat = (discFolder && DISC_FOLDERS[discFolder.toLowerCase()]) ?? extensionFormat;

  const file = analyzeName(base, maxYear);
  let { title, year, season, episode } = file;
  let usedFolder = false;

  // A season folder gives the season of an episode named `E05` or `Episode 5`.
  const seasonFolder = folders
    .map((folder) => SEASON_FOLDER.exec(normalizeName(folder)))
    .findLast((match) => match !== null);
  if (season === undefined && seasonFolder?.[1]) {
    const episodeMatch = EPISODE_ONLY.exec(normalizeName(base));
    if (episodeMatch?.[1]) {
      season = Number(seasonFolder[1]);
      episode = Number(episodeMatch[1]);
      const before = normalizeName(base).slice(0, episodeMatch.index).trim();
      title = cleanTitle(before.split(' '));
    }
  }

  // The nearest folder that names the title (skipping `Season 1`, `BDMV`, `CD1`, …).
  const titleFolder = folders
    .filter((folder) => !GROUPING_FOLDER.test(normalizeName(folder)))
    .at(-1);
  const folder = titleFolder ? analyzeName(titleFolder, maxYear) : undefined;

  const generic = title === null || GENERIC_NAME.test(normalizeName(base)) || discFolder;
  if (generic) {
    title = folder?.title ?? null;
    year ??= folder?.year;
    usedFolder = title !== null;
  } else if (folder?.title && title && sameTitle(title, folder.title)) {
    // `Inception (2010)/Inception.mkv`, `Severance (2022)/Season 1/Severance S01E01.mkv`.
    year ??= folder.year;
  }

  const isTv = season !== undefined && episode !== undefined;
  const kind: ParsedMedia['kind'] = isTv ? 'tv' : year !== undefined ? 'movie' : 'unknown';

  let confidence = 0;
  if (title) {
    confidence = 0.4;
    if (year !== undefined) confidence += 0.35;
    if (isTv) confidence += 0.25;
    if (file.hasQuality || folder?.hasQuality) confidence += 0.1;
    if (usedFolder) confidence -= 0.1;
    if (title.length < 2) confidence -= 0.2;
  }

  return {
    kind,
    title,
    ...(year !== undefined ? { year } : {}),
    ...(isTv ? { season, episode } : {}),
    // The file's own tokens first; a release-named folder fills the gaps.
    ...defined('resolution', file.resolution ?? folder?.resolution),
    ...defined('hdr', file.hdr ?? folder?.hdr),
    ...defined('source', file.source ?? folder?.source),
    ...defined('audioChannels', file.audioChannels ?? folder?.audioChannels),
    ...defined('fileFormat', fileFormat),
    confidence: Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100,
  };
}
