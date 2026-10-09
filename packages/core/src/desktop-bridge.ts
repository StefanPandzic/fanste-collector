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

/** The app's theme setting, as next-themes stores it. */
export type DesktopTheme = 'light' | 'dark' | 'system';

export interface DesktopWindowApi {
  /**
   * Makes the native window chrome (title-bar controls, background) follow the app theme. Also sets
   * the renderer's `prefers-color-scheme`, so `system` hands the choice back to the OS.
   */
  setTheme(theme: DesktopTheme): Promise<void>;
}
