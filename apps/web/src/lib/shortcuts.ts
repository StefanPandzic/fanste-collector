import type { DesktopOs } from '@fanste/core';

type KeyInfo = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

/** The global search shortcut (FC-17): Cmd+K on macOS, Ctrl+K elsewhere. */
export function isSearchShortcut(event: KeyInfo, os: DesktopOs): boolean {
  if (event.altKey || event.shiftKey || event.key.toLowerCase() !== 'k') return false;
  return os === 'macos' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/** How the search shortcut is written on `os`, e.g. `⌘K` or `Ctrl+K`. */
export function searchShortcutLabel(os: DesktopOs): string {
  return os === 'macos' ? '⌘K' : 'Ctrl+K';
}
