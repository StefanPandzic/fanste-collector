import { describe, expect, it } from 'vitest';

import { isSearchShortcut, searchShortcutLabel } from './shortcuts';

const noModifiers = { key: 'k', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };

describe('isSearchShortcut', () => {
  it('matches Cmd+K on macOS and Ctrl+K elsewhere', () => {
    expect(isSearchShortcut({ ...noModifiers, metaKey: true }, 'macos')).toBe(true);
    expect(isSearchShortcut({ ...noModifiers, ctrlKey: true }, 'windows')).toBe(true);
    expect(isSearchShortcut({ ...noModifiers, ctrlKey: true, key: 'K' }, 'linux')).toBe(true);
  });

  it('ignores other key combinations', () => {
    expect(isSearchShortcut({ ...noModifiers, ctrlKey: true }, 'macos')).toBe(false);
    expect(isSearchShortcut({ ...noModifiers, metaKey: true }, 'windows')).toBe(false);
    expect(isSearchShortcut({ ...noModifiers, ctrlKey: true, shiftKey: true }, 'windows')).toBe(
      false,
    );
    expect(isSearchShortcut({ ...noModifiers, ctrlKey: true, key: 'f' }, 'windows')).toBe(false);
  });
});

describe('searchShortcutLabel', () => {
  it('writes the shortcut for the OS', () => {
    expect(searchShortcutLabel('macos')).toBe('⌘K');
    expect(searchShortcutLabel('windows')).toBe('Ctrl+K');
  });
});
