import { afterEach, describe, expect, it, vi } from 'vitest';

import { isDesktop } from './platform';

describe('isDesktop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false on the server', () => {
    expect(isDesktop()).toBe(false);
  });

  it('is false in a normal browser', () => {
    vi.stubGlobal('window', {});
    expect(isDesktop()).toBe(false);
  });

  it('is true when the Electron preload bridge is present', () => {
    vi.stubGlobal('window', { fanste: {} });
    expect(isDesktop()).toBe(true);
  });
});
