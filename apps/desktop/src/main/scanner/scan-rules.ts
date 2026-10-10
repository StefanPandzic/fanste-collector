/** Which files and folders the scanner reads (FC-21). Pure, so it is unit-tested without a disk. */

/** Video file extensions the scanner collects. */
export const VIDEO_EXTENSIONS: ReadonlySet<string> = new Set([
  '.mkv',
  '.mp4',
  '.avi',
  '.mov',
  '.m4v',
  '.wmv',
  '.ts',
  '.webm',
]);

/** System and NAS folders that never hold a library (compared lowercased). */
const SYSTEM_FOLDERS: ReadonlySet<string> = new Set([
  'system volume information',
  'recycler',
  'lost+found',
  '@eadir', // Synology thumbnails
  '#recycle', // Synology recycle bin
  '#snapshot',
]);

/** Folders of extras, not of the movies themselves. */
const EXTRAS_FOLDERS: ReadonlySet<string> = new Set(['sample', 'samples', 'trailer', 'trailers']);

/** The extension, lowercased with its dot (`.mkv`), or `''`. */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot).toLowerCase() : '';
}

/** The file name without its extension. */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * `true` for folders the walk doesn't enter: hidden ones (`.git`, `.Trashes`), Windows system
 * folders (`$RECYCLE.BIN`, `System Volume Information`), NAS metadata (`@eaDir`) and sample or
 * trailer folders.
 */
export function isSkippedDirectory(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('.') ||
    lower.startsWith('$') ||
    SYSTEM_FOLDERS.has(lower) ||
    EXTRAS_FOLDERS.has(lower)
  );
}

/** `true` if the name looks like a sample or a trailer (`movie-sample.mkv`, `Movie-trailer.mp4`). */
export function isSampleOrTrailer(fileName: string): boolean {
  const base = baseName(fileName).toLowerCase();
  return /(^|[._\- ])sample([._\- ]|$)/.test(base) || /[._\- ]trailer$/.test(base);
}

/**
 * `true` if the file is a video the scanner collects: an allowed extension, not hidden (macOS `._`
 * files), not a sample or trailer, and at least `minSizeBytes` big.
 */
export function isCollectedVideo(fileName: string, size: number, minSizeBytes: number): boolean {
  return (
    !fileName.startsWith('.') &&
    VIDEO_EXTENSIONS.has(fileExtension(fileName)) &&
    !isSampleOrTrailer(fileName) &&
    size >= minSizeBytes
  );
}

/** Megabytes (the scan option) to bytes. */
export function megabytesToBytes(megabytes: number): number {
  return Math.round(megabytes * 1024 * 1024);
}
