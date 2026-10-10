import type { DesktopOs } from '../desktop-bridge';

/**
 * The key that identifies a path on a device (`scanned_files.path_key`, FC-21). Windows and default
 * macOS file systems are case-insensitive, so `E:\Movies\A.mkv` and `e:/movies/a.mkv` must get the
 * same key:
 *
 * - Windows: `\` becomes `/` and the path is lowercased.
 * - macOS: lowercased (`\` is a valid file name character there, so it stays).
 * - Linux: only the trailing separator and Unicode form are normalized.
 *
 * Every key is NFC (macOS file systems can return decomposed names) and has no trailing `/`, except
 * a root (`/`, `c:/`).
 */
export function toPathKey(path: string, os: DesktopOs): string {
  let key = path.normalize('NFC');
  if (os === 'windows') key = key.replaceAll('\\', '/');
  if (os !== 'linux') key = key.toLowerCase();
  // Collapse repeated separators, but keep the leading `//` of a Windows UNC path.
  const unc = os === 'windows' && key.startsWith('//');
  key = (unc ? '/' : '') + key.replace(/\/{2,}/g, '/');
  if (key.length > 1 && key.endsWith('/') && !/^[a-z]:\/$/.test(key)) key = key.slice(0, -1);
  return key;
}

/** `true` if `childKey` is `parentKey` or lies inside it. Both must be {@link toPathKey} keys. */
export function isPathInside(childKey: string, parentKey: string): boolean {
  if (childKey === parentKey) return true;
  const prefix = parentKey.endsWith('/') ? parentKey : `${parentKey}/`;
  return childKey.startsWith(prefix);
}
