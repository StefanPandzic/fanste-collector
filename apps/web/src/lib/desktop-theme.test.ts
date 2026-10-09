import { describe, expect, it } from 'vitest';

import { toDesktopTheme } from './desktop-theme';

describe('toDesktopTheme', () => {
  it('passes the desktop themes through', () => {
    expect(toDesktopTheme('light')).toBe('light');
    expect(toDesktopTheme('dark')).toBe('dark');
    expect(toDesktopTheme('system')).toBe('system');
  });

  it('returns undefined for anything else', () => {
    expect(toDesktopTheme(undefined)).toBeUndefined();
    expect(toDesktopTheme('blue')).toBeUndefined();
  });
});
