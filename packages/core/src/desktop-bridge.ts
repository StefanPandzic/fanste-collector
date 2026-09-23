/**
 * Contract between the Electron preload script (`apps/desktop/src/preload`) and the web app.
 * The desktop app exposes an object of this shape as `window.fanste` via `contextBridge`; in a
 * normal browser `window.fanste` is `undefined`.
 *
 * Everything crossing the bridge is copied (structured clone), so only plain data and functions.
 */
export interface FansteDesktopBridge {
  readonly platform: DesktopPlatformInfo;
  /** Local media scanner (SRS §3.2), implemented in FC-21. */
  readonly scanner: DesktopScannerApi;
}

/** Operating system the desktop app runs on. Linux is not a v1 target but works for development. */
export type DesktopOs = 'windows' | 'macos' | 'linux';

export interface DesktopPlatformInfo {
  readonly os: DesktopOs;
  /** Desktop app version, e.g. `1.0.0`. */
  readonly appVersion: string;
}

export interface DesktopScannerApi {
  /** Opens the native folder picker. Resolves to the chosen absolute paths, or `[]` if cancelled. */
  selectDirectories(): Promise<string[]>;
  /** Starts scanning the given directories. Progress is reported through {@link onScanProgress}. */
  startScan(directories: readonly string[]): Promise<void>;
  /** Subscribes to scan progress. Returns a function that removes the listener. */
  onScanProgress(listener: (progress: ScanProgress) => void): () => void;
}

export interface ScanProgress {
  /** Media files found so far. */
  readonly filesFound: number;
  /** Absolute path of the directory being scanned. */
  readonly currentDirectory: string;
}
