import { describe, expect, it } from 'vitest';

import { parseScannerSettings } from './settings';

describe('parseScannerSettings', () => {
  it('reads the stored settings', () => {
    expect(parseScannerSettings({ scanner: { autoAdd: false }, copyDefaults: {} })).toEqual({
      autoAdd: false,
    });
  });

  it('falls back to the defaults for missing or invalid values', () => {
    expect(parseScannerSettings({ copyDefaults: {} })).toEqual({ autoAdd: true });
    expect(parseScannerSettings({ scanner: { autoAdd: 'no' } })).toEqual({ autoAdd: true });
    expect(parseScannerSettings(null)).toEqual({ autoAdd: true });
  });
});
