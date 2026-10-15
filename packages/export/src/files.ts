import { strToU8, zipSync } from 'fflate';

// File names and the ZIP of per-group CSV files (FC-25).

export const EXPORT_FILE_PREFIX = 'fanste-collection';

/** A local date as `YYYY-MM-DD`. */
export function localIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** e.g. `fanste-collection-2026-10-15.csv`. */
export function exportFileName(date: Date, extension: string): string {
  return `${EXPORT_FILE_PREFIX}-${localIsoDate(date)}.${extension}`;
}

/**
 * A file-name-safe version of a label, e.g. `Video Games` → `video-games`. Letters of any script
 * are kept; `item` when nothing is left.
 */
export function fileSlug(label: string): string {
  const slug = label
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'item';
}

/** Unique file names for labels: a repeated name gets `-2`, `-3`, ... */
export function uniqueFileNames(labels: readonly string[], extension: string): string[] {
  const used = new Set<string>();
  return labels.map((label) => {
    const base = fileSlug(label);
    let name = `${base}.${extension}`;
    for (let index = 2; used.has(name); index += 1) name = `${base}-${index}.${extension}`;
    used.add(name);
    return name;
  });
}

export interface TextFile {
  name: string;
  content: string;
}

/** A ZIP archive of text files, UTF-8 encoded. */
export function buildZip(files: readonly TextFile[]): Uint8Array {
  return zipSync(Object.fromEntries(files.map((file) => [file.name, strToU8(file.content)])));
}
