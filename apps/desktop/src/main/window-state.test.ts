import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isOnScreen, parseWindowState, readWindowState, writeWindowState } from './window-state';

const state = { bounds: { x: 100, y: 80, width: 1280, height: 800 }, isMaximized: false };

describe('parseWindowState', () => {
  it('accepts a valid state', () => {
    expect(parseWindowState(state)).toEqual(state);
  });

  it('drops unknown properties', () => {
    expect(parseWindowState({ ...state, extra: 1, bounds: { ...state.bounds, z: 3 } })).toEqual(
      state,
    );
  });

  it('rejects malformed data', () => {
    expect(parseWindowState(null)).toBeUndefined();
    expect(parseWindowState('state')).toBeUndefined();
    expect(parseWindowState({ bounds: state.bounds })).toBeUndefined();
    expect(parseWindowState({ ...state, bounds: { ...state.bounds, x: '100' } })).toBeUndefined();
    expect(parseWindowState({ ...state, bounds: { ...state.bounds, y: NaN } })).toBeUndefined();
    expect(parseWindowState({ ...state, bounds: { ...state.bounds, width: 0 } })).toBeUndefined();
  });
});

describe('isOnScreen', () => {
  const primary = { x: 0, y: 0, width: 1920, height: 1040 };
  const leftMonitor = { x: -1920, y: 0, width: 1920, height: 1040 };

  it('accepts a window on a display', () => {
    expect(isOnScreen(state.bounds, [primary])).toBe(true);
    expect(isOnScreen({ x: -1500, y: 100, width: 1000, height: 700 }, [primary, leftMonitor])).toBe(
      true,
    );
  });

  it('accepts a window that is only partly on screen', () => {
    expect(isOnScreen({ x: 1800, y: 100, width: 1000, height: 700 }, [primary])).toBe(true);
  });

  it('rejects a window on a disconnected display', () => {
    expect(isOnScreen({ x: -1500, y: 100, width: 1000, height: 700 }, [primary])).toBe(false);
  });

  it('rejects a window with only a sliver on screen', () => {
    expect(isOnScreen({ x: 1880, y: 100, width: 1000, height: 700 }, [primary])).toBe(false);
  });
});

describe('readWindowState / writeWindowState', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'fanste-window-state-'));
    file = path.join(dir, 'window-state.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips the state', () => {
    writeWindowState(file, state);
    expect(readWindowState(file)).toEqual(state);
  });

  it('returns undefined for a missing or corrupt file', () => {
    expect(readWindowState(file)).toBeUndefined();
    writeFileSync(file, '{ not json');
    expect(readWindowState(file)).toBeUndefined();
  });
});
