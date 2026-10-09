import { describe, expect, it } from 'vitest';

import {
  TITLE_BAR_HEIGHT,
  WINDOW_BACKGROUND,
  parseDesktopTheme,
  titleBarOptions,
  titleBarOverlay,
} from './title-bar';

describe('parseDesktopTheme', () => {
  it('accepts the desktop themes', () => {
    expect(parseDesktopTheme('light')).toBe('light');
    expect(parseDesktopTheme('dark')).toBe('dark');
    expect(parseDesktopTheme('system')).toBe('system');
  });

  it('rejects anything else', () => {
    expect(() => parseDesktopTheme('blue')).toThrow(TypeError);
    expect(() => parseDesktopTheme(undefined)).toThrow(/"light", "dark" or "system"/);
  });
});

describe('titleBarOverlay', () => {
  it('matches the top bar colors and height', () => {
    expect(titleBarOverlay(true)).toEqual({
      color: WINDOW_BACKGROUND.dark,
      symbolColor: '#fafafa',
      height: TITLE_BAR_HEIGHT,
    });
    expect(titleBarOverlay(false).color).toBe(WINDOW_BACKGROUND.light);
  });
});

describe('titleBarOptions', () => {
  it('insets the traffic lights on macOS', () => {
    const options = titleBarOptions('macos', false);
    expect(options.titleBarStyle).toBe('hiddenInset');
    expect(options).toHaveProperty('trafficLightPosition', { x: 16, y: 20 });
    expect(options).not.toHaveProperty('titleBarOverlay');
  });

  it('draws a controls overlay on Windows and Linux', () => {
    expect(titleBarOptions('windows', true)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: titleBarOverlay(true),
    });
    expect(titleBarOptions('linux', false).titleBarStyle).toBe('hidden');
  });
});
