import type { ExportFile } from '@fanste/export';

/** Downloads a file through a temporary `a[download]` link. */
export function downloadFile({ name, mimeType, data }: ExportFile): void {
  // A copy into a plain `ArrayBuffer`-backed view, which `Blob` takes in every browser's typings.
  const part = typeof data === 'string' ? data : new Uint8Array(data);
  const url = URL.createObjectURL(
    new Blob([part], { type: mimeType === 'text/csv' ? `${mimeType};charset=utf-8` : mimeType }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Saves an export: through the native Save dialog in the desktop app (FC-25), otherwise as a browser
 * download. Resolves to `false` when the user cancelled the dialog.
 */
export async function saveFile(file: ExportFile): Promise<boolean> {
  const files = typeof window === 'undefined' ? undefined : window.fanste?.files;
  if (!files) {
    downloadFile(file);
    return true;
  }
  const result = await files.saveFile({ defaultName: file.name, type: file.type, data: file.data });
  return result.saved;
}
