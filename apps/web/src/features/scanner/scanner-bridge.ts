import type { DesktopScannerApi } from '@fanste/core';

/** The desktop scanner bridge, or `undefined` in a browser or a desktop build older than FC-21. */
export function scannerBridge(): DesktopScannerApi | undefined {
  const scanner = typeof window === 'undefined' ? undefined : window.fanste?.scanner;
  // Desktop builds before FC-21 only had stubs; the web app can be newer than the desktop app.
  return typeof scanner?.getDeviceId === 'function' ? scanner : undefined;
}

/** Query of this device's ID: shared by the scanner page and the background matcher. */
export function deviceIdQuery(scanner: DesktopScannerApi | undefined) {
  return {
    queryKey: ['desktop-scanner', 'device-id'] as const,
    queryFn: () => scanner!.getDeviceId(),
    enabled: scanner !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  };
}
