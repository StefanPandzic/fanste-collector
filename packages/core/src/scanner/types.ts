/** `scanned_files.match_status` values (FC-05). FC-21 writes `pending`; FC-23/FC-24 set the others. */
export const SCAN_MATCH_STATUSES = [
  'pending',
  'matched',
  'unmatched',
  'ignored',
  'manual',
] as const;
export type ScanMatchStatus = (typeof SCAN_MATCH_STATUSES)[number];

/** A video file the desktop scanner found on disk (FC-21). Crosses the preload bridge. */
export interface ScannedFileInfo {
  /** Absolute path with the file system's own separators and case, for display and parsing. */
  readonly path: string;
  /** The file's identity on this device (`toPathKey`): what `scanned_files.path_key` stores. */
  readonly pathKey: string;
  /** Size in bytes. */
  readonly size: number;
  /** Last modification time, ISO 8601. */
  readonly modifiedAt: string;
  /** Languages of the sidecar subtitle files next to the video (ISO 639 codes, no duplicates). */
  readonly subtitleLanguages: readonly string[];
}

/** Video files smaller than this are skipped (samples, extras), unless the scan sets its own. */
export const DEFAULT_MIN_VIDEO_SIZE_MB = 50;
/** The largest `minFileSizeMb` a scan accepts. */
export const MAX_MIN_VIDEO_SIZE_MB = 10_000;

/** The most files one `probeFiles` call reads (FC-22). */
export const MAX_PROBE_FILES = 50;
