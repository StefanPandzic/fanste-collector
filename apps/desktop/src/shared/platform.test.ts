import { describe, expect, it } from 'vitest';

import { toDesktopOs } from './platform';

describe('toDesktopOs', () => {
  it('maps Node platforms to bridge OS names', () => {
    expect(toDesktopOs('win32')).toBe('windows');
    expect(toDesktopOs('darwin')).toBe('macos');
    expect(toDesktopOs('linux')).toBe('linux');
  });
});
