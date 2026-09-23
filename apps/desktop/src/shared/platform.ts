import type { DesktopOs } from '@fanste/core';

/** Maps Node's `process.platform` to the bridge's {@link DesktopOs}. */
export function toDesktopOs(platform: NodeJS.Platform): DesktopOs {
  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      return 'linux';
  }
}
