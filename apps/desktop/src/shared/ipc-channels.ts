/** IPC channel names shared by the main process and the preload script. */
export const IpcChannel = {
  /** invoke → `string[]` */
  scannerSelectDirectories: 'scanner:select-directories',
  /** invoke(directories: string[]) → `void` */
  scannerStartScan: 'scanner:start-scan',
  /** main → renderer event carrying a `ScanProgress` */
  scannerProgress: 'scanner:progress',
} as const;
