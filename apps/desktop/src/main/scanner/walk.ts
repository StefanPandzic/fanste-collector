import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';

import { isSubtitleFile, subtitleLanguage, toPathKey } from '@fanste/core';

import { baseName, isCollectedVideo, isSkippedDirectory } from './scan-rules';

import type { DesktopOs, ScannedFileInfo } from '@fanste/core';

export interface WalkOptions {
  /** Videos smaller than this are skipped. */
  readonly minSizeBytes: number;
  readonly os: DesktopOs;
  /** Called before each folder is read. */
  readonly onDirectory: (directory: string) => void;
  readonly onFile: (file: ScannedFileInfo) => void;
  /** Called with the path key of a video that is on disk but smaller than `minSizeBytes`. */
  readonly onTooSmall: (pathKey: string) => void;
}

/**
 * Walks a library folder (FC-21) and reports every collected video with its sidecar subtitle
 * languages. Skipped folders and symbolic links aren't entered, so a link loop can't trap the walk.
 * Runs in the scan worker; it uses only `node:fs`, so it is tested against a temp folder.
 *
 * @returns `complete: false` if a folder inside couldn't be read; then the scan can't tell which
 *   files are gone, so none should be marked as removed.
 * @throws If the folder itself can't be read (missing, unplugged, no permission).
 */
export async function walkLibraryFolder(
  rootPath: string,
  options: WalkOptions,
): Promise<{ complete: boolean }> {
  let complete = true;
  const pending = [rootPath];

  for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
    options.onDirectory(directory);
    const subdirectories: string[] = [];
    const videos: string[] = [];
    const subtitles: string[] = [];

    try {
      for await (const entry of await opendir(directory)) {
        if (entry.isDirectory()) {
          if (!isSkippedDirectory(entry.name)) subdirectories.push(entry.name);
        } else if (entry.isFile()) {
          if (isSubtitleFile(entry.name)) subtitles.push(entry.name);
          // Size is checked after `stat`; 0 lets everything else through here.
          else if (isCollectedVideo(entry.name, 0, 0)) videos.push(entry.name);
        }
      }
    } catch (error) {
      if (directory === rootPath) throw error;
      complete = false;
      continue;
    }

    const files = await Promise.all(
      videos.map((name) => readVideo(directory, name, subtitles, options)),
    );
    for (const file of files) if (file) options.onFile(file);

    // Reversed, so the stack visits subfolders in the order the file system listed them.
    for (const name of subdirectories.reverse()) pending.push(path.join(directory, name));
  }

  return { complete };
}

async function readVideo(
  directory: string,
  name: string,
  subtitles: readonly string[],
  options: WalkOptions,
): Promise<ScannedFileInfo | undefined> {
  const filePath = path.join(directory, name);
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return undefined; // Deleted while the folder was being read.
  }
  const pathKey = toPathKey(filePath, options.os);
  if (!isCollectedVideo(name, info.size, options.minSizeBytes)) {
    // Still on disk: reported, so raising the minimum size never marks it as removed.
    options.onTooSmall(pathKey);
    return undefined;
  }

  const video = baseName(name);
  const languages = new Set<string>();
  for (const subtitle of subtitles) {
    const language = subtitleLanguage(subtitle, video);
    if (language) languages.add(language);
  }

  return {
    path: filePath,
    pathKey,
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
    subtitleLanguages: [...languages],
  };
}
