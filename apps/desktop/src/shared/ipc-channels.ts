/** IPC channel names shared by the main process and the preload script. */
export const IpcChannel = {
  /** invoke → `string` */
  scannerGetDeviceId: 'scanner:get-device-id',
  /** invoke → `LibraryFolder[]` */
  scannerGetLibraryFolders: 'scanner:get-library-folders',
  /** invoke → `LibraryFolder[]` (the added ones) */
  scannerSelectDirectories: 'scanner:select-directories',
  /** invoke(path: string) → `void` */
  scannerRemoveLibraryFolder: 'scanner:remove-library-folder',
  /** invoke(options?: ScanOptions) → `ScanResult` */
  scannerStartScan: 'scanner:start-scan',
  /** invoke → `void` */
  scannerCancelScan: 'scanner:cancel-scan',
  /** main → renderer event carrying a `ScanProgress` */
  scannerProgress: 'scanner:progress',
  /** main → renderer event carrying a `ScanFileBatch` */
  scannerFilesFound: 'scanner:files-found',
  /** invoke(theme: DesktopTheme) → `void` */
  windowSetTheme: 'window:set-theme',
} as const;
