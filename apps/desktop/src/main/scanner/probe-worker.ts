/**
 * Probe worker (FC-22): reads video files' headers with MediaInfo (WebAssembly) on a worker thread,
 * so the main process never blocks. MediaInfo asks for the parts of the file it needs, which for
 * most files is a few MB at the start (and the index at the end), never the whole file. Started by
 * `media-prober.ts` through electron-vite's `?nodeWorker` import.
 */
import { open } from 'node:fs/promises';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';

import mediaInfoFactory from 'mediainfo.js';

import { toMediaInfo } from './media-probe';

import type { MediaInfo } from '@fanste/core';
import type { MediaInfo as MediaInfoReader } from 'mediainfo.js';
import type { FileHandle } from 'node:fs/promises';

export interface ProbeWorkerData {
  /** Absolute path of `MediaInfoModule.wasm`. */
  wasmPath: string;
}

export interface ProbeRequest {
  id: number;
  paths: string[];
}

export type ProbeResponse =
  | {
      id: number;
      /** In the order of the request's paths; `null` for a file that couldn't be read. */
      results: (MediaInfo | null)[];
    }
  /** The request failed as a whole (MediaInfo couldn't load). */
  | { id: number; error: string };

const { wasmPath } = workerData as ProbeWorkerData;
const mediaInfo = mediaInfoFactory({ format: 'object', locateFile: () => wasmPath });
// Handled by each request (`answer`); this only keeps an early failure from crashing the thread.
mediaInfo.catch(() => undefined);

/**
 * The media info of one file. Only a file MediaInfo read but couldn't make sense of gives `{}`
 * (stored as "nothing found"); a file that couldn't be opened or read (gone, locked, a drive that
 * dropped) gives `null`, so it is tried again later.
 */
async function probe(
  reader: MediaInfoReader<'object'>,
  filePath: string,
): Promise<MediaInfo | null> {
  let handle: FileHandle;
  try {
    handle = await open(filePath, 'r');
  } catch {
    return null;
  }
  // `true` until `stat` succeeds, and again if a read fails.
  let readFailed = true;
  try {
    const { size } = await handle.stat();
    readFailed = false;
    const result = await reader.analyzeData(size, async (chunkSize, offset) => {
      try {
        const buffer = new Uint8Array(chunkSize);
        const { bytesRead } = await handle.read(buffer, 0, chunkSize, offset);
        return buffer.subarray(0, bytesRead);
      } catch (error) {
        readFailed = true;
        throw error;
      }
    });
    return toMediaInfo(result, path.extname(filePath));
  } catch {
    // `stat` or a read failed: try again later. Otherwise the data isn't media MediaInfo knows.
    return readFailed ? null : {};
  } finally {
    await handle.close();
  }
}

async function answer(request: ProbeRequest): Promise<void> {
  // Outside the per-file handling: if the WebAssembly can't load, the request fails as a whole
  // instead of every file being stored as "nothing found".
  const reader = await mediaInfo;
  const results: (MediaInfo | null)[] = [];
  for (const filePath of request.paths) results.push(await probe(reader, filePath));
  parentPort?.postMessage({ id: request.id, results } satisfies ProbeResponse);
}

// One file at a time, requests in order: a MediaInfo instance analyzes one file at once, and the
// disk is the limit anyway.
let queue = Promise.resolve();
parentPort?.on('message', (request: ProbeRequest) => {
  queue = queue
    .then(() => answer(request))
    .catch((error: unknown) => {
      parentPort?.postMessage({
        id: request.id,
        error: error instanceof Error ? error.message : String(error),
      } satisfies ProbeResponse);
    });
});
