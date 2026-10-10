import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { walkLibraryFolder } from './walk';

import type { ScannedFileInfo } from '@fanste/core';

let root: string;

function write(relativePath: string, size = 10) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.alloc(size));
}

async function walk(folder: string, minSizeBytes = 0) {
  const files: ScannedFileInfo[] = [];
  const tooSmall: string[] = [];
  const result = await walkLibraryFolder(folder, {
    minSizeBytes,
    os: 'linux',
    onDirectory: () => undefined,
    onFile: (file) => files.push(file),
    onTooSmall: (pathKey) => tooSmall.push(pathKey),
  });
  return { files, tooSmall, result };
}

describe('walkLibraryFolder', () => {
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'fanste-walk-'));
    write('Inception (2010)/Inception.2010.mkv', 100);
    write('Inception (2010)/Inception.2010.en.srt');
    write('Inception (2010)/Inception.2010.srp.forced.srt');
    write('Inception (2010)/Sample/Inception.sample.mkv', 100);
    write('Dune (2021)/Dune.2021.mp4', 20);
    write('Dune (2021)/dune-trailer.mp4', 100);
    write('.hidden/Secret.mkv', 100);
    write('Notes.txt');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('collects videos with their subtitle languages', async () => {
    const { files, result } = await walk(root);
    expect(result).toEqual({ complete: true });
    expect(files.map((file) => path.relative(root, file.path)).sort()).toEqual([
      path.join('Dune (2021)', 'Dune.2021.mp4'),
      path.join('Inception (2010)', 'Inception.2010.mkv'),
    ]);
    const inception = files.find((file) => file.path.endsWith('Inception.2010.mkv'));
    expect(inception).toHaveProperty('size', 100);
    expect([...(inception?.subtitleLanguages ?? [])].sort()).toEqual(['en', 'sr']);
  });

  it('skips videos below the minimum size, but reports them as on disk', async () => {
    const { files, tooSmall } = await walk(root, 50);
    expect(files.map((file) => path.basename(file.path))).toEqual(['Inception.2010.mkv']);
    expect(tooSmall.length).toBeGreaterThan(0);
    expect(tooSmall.every((key) => !key.includes('Inception'))).toBe(true);
  });

  it('throws for a missing folder', async () => {
    await expect(walk(path.join(root, 'Unplugged'))).rejects.toThrow(/ENOENT/);
  });
});
