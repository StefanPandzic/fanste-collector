import type { ScannedFileInfo } from './scanner/types';

/**
 * Contract between the Electron preload script (`apps/desktop/src/preload`) and the web app.
 * The desktop app exposes an object of this shape as `window.fanste` via `contextBridge`; in a
 * normal browser `window.fanste` is `undefined`.
 *
 * Everything crossing the bridge is copied (structured clone), so only plain data and functions.
 *
 * The desktop app loads the deployed web app, so an older desktop build can lack members added
 * later (e.g. `window`, FC-16). Web code calling such a member on every page should check it exists.
 */
export interface FansteDesktopBridge {
  readonly platform: DesktopPlatformInfo;
  /** Local media scanner (SRS §3.2), implemented in FC-21. */
  readonly scanner: DesktopScannerApi;
  /** The native window around the web app (FC-16). */
  readonly window: DesktopWindowApi;
}

/** Operating system the desktop app runs on. Linux is not a v1 target but works for development. */
export type DesktopOs = 'windows' | 'macos' | 'linux';

export interface DesktopPlatformInfo {
  readonly os: DesktopOs;
  /** Desktop app version, e.g. `1.0.0`. */
  readonly appVersion: string;
}

/**
 * The local media scanner (FC-21). The desktop app walks the library folders and reports the video
 * files it finds; the web app writes them to `scanned_files`. Only folders the user picked in the
 * native dialog (and folders inside them) can be scanned.
 */
export interface DesktopScannerApi {
  /** This installation's ID, generated once and kept locally: `scanned_files.device_id`. */
  getDeviceId(): Promise<string>;
  /** The library folders, in the order they were added. */
  getLibraryFolders(): Promise<LibraryFolder[]>;
  /**
   * Opens the native folder picker (multi-select) and adds the chosen folders to the library.
   * Resolves to the folders that were added (`[]` if cancelled or all were already there).
   */
  selectDirectories(): Promise<LibraryFolder[]>;
  /** Removes a library folder. Its files stay on disk; the web app marks their rows as removed. */
  removeLibraryFolder(path: string): Promise<void>;
  /**
   * Scans library folders. Found files arrive through {@link onFilesFound}, progress through
   * {@link onScanProgress}; the promise resolves when the scan finishes or is cancelled. Rejects if
   * a scan is already running or a folder isn't in the library.
   */
  startScan(options?: ScanOptions): Promise<ScanResult>;
  /** Stops the running scan, if any. Its `startScan` promise resolves with `cancelled: true`. */
  cancelScan(): Promise<void>;
  /** Subscribes to scan progress. Returns a function that removes the listener. */
  onScanProgress(listener: (progress: ScanProgress) => void): () => void;
  /** Subscribes to found files, sent in batches. Returns a function that removes the listener. */
  onFilesFound(listener: (batch: ScanFileBatch) => void): () => void;
}

export interface LibraryFolder {
  /** Absolute path, with the case the file system reports. */
  readonly path: string;
  /** The path's {@link ScannedFileInfo.pathKey | path key}. */
  readonly pathKey: string;
  /** When it was added, ISO 8601. */
  readonly addedAt: string;
}

export interface ScanOptions {
  /** Library folders (or folders inside them) to scan. Defaults to the whole library. */
  readonly folders?: readonly string[];
  /** Smaller video files are skipped. Defaults to `DEFAULT_MIN_VIDEO_SIZE_MB`. */
  readonly minFileSizeMb?: number;
}

export interface ScanProgress {
  readonly scanId: string;
  /** Video files found so far. */
  readonly filesFound: number;
  /** Folders read so far. */
  readonly directoriesScanned: number;
  /** Absolute path of the folder being read. */
  readonly currentDirectory: string;
}

export interface ScanFileBatch {
  readonly scanId: string;
  readonly files: readonly ScannedFileInfo[];
  /**
   * Path keys of videos on disk that are smaller than the scan's minimum size. They aren't collected,
   * but they aren't gone either, so they must not be marked as removed.
   */
  readonly tooSmallKeys: readonly string[];
}

export interface ScanResult {
  readonly scanId: string;
  /** `true` if the scan was cancelled (or the window closed). Folders it hadn't finished aren't listed. */
  readonly cancelled: boolean;
  /**
   * The scanned folders that were read completely. Only files inside these may be marked as
   * removed: a folder that is missing (an unplugged drive) or partly unreadable isn't listed.
   */
  readonly completedFolders: readonly ScannedFolder[];
  /** The scanned folders that couldn't be read completely. */
  readonly failedFolders: readonly ScannedFolder[];
  /** Video files found. */
  readonly filesFound: number;
}

export interface ScannedFolder {
  readonly path: string;
  readonly pathKey: string;
}

/** The app's theme setting, as next-themes stores it. */
export type DesktopTheme = 'light' | 'dark' | 'system';

export interface DesktopWindowApi {
  /**
   * Makes the native window chrome (title-bar controls, background) follow the app theme. Also sets
   * the renderer's `prefers-color-scheme`, so `system` hands the choice back to the OS.
   */
  setTheme(theme: DesktopTheme): Promise<void>;
}
