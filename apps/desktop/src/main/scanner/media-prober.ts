import wasmPath from 'mediainfo.js/MediaInfoModule.wasm?asset&asarUnpack';

import createProbeWorker from './probe-worker?nodeWorker';

import type { ProbeRequest, ProbeResponse, ProbeWorkerData } from './probe-worker';
import type { MediaInfo } from '@fanste/core';
import type { Worker } from 'node:worker_threads';

/** The worker is stopped after this long without requests, so an idle app holds no WebAssembly. */
const IDLE_TIMEOUT_MS = 60_000;
/**
 * How long one file may take. A read on a drive that dropped can hang; then the worker is stopped,
 * so the scanner page doesn't wait forever and the next request gets a fresh worker.
 */
const PER_FILE_TIMEOUT_MS = 30_000;

interface Pending {
  resolve: (results: (MediaInfo | null)[]) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  fileCount: number;
}

/**
 * Reads video files' headers on a worker thread (FC-22, `probe-worker.ts`). The worker starts on
 * the first request and stops when it has been idle for a minute, or when a request times out.
 */
export class MediaProber {
  private worker: Worker | undefined;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private idleTimer: NodeJS.Timeout | undefined;

  /** The media info of each file, in order; `null` for a file that couldn't be read. */
  probe(paths: readonly string[]): Promise<(MediaInfo | null)[]> {
    const worker = this.start();
    clearTimeout(this.idleTimer);
    const id = this.nextId++;
    // Requests run one after another, so the deadline covers the ones queued before this one too.
    let files = paths.length;
    for (const request of this.pending.values()) files += request.fileCount;
    const timeout = PER_FILE_TIMEOUT_MS * files;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.stop(new Error('Reading the media info timed out')),
        timeout,
      );
      this.pending.set(id, { resolve, reject, timer, fileCount: paths.length });
      worker.postMessage({ id, paths: [...paths] } satisfies ProbeRequest);
    });
  }

  /** Stops the worker; pending requests reject. */
  dispose(): void {
    this.stop(new Error('The media prober was stopped'));
  }

  private start(): Worker {
    if (this.worker) return this.worker;
    const worker = createProbeWorker({ workerData: { wasmPath } satisfies ProbeWorkerData });
    worker.on('message', (response: ProbeResponse) => {
      const request = this.pending.get(response.id);
      if (!request) return;
      this.pending.delete(response.id);
      clearTimeout(request.timer);
      if ('error' in response) {
        console.error(`[scanner] Reading media info failed: ${response.error}`);
        request.reject(new Error("The media info couldn't be read"));
      } else {
        request.resolve(response.results);
      }
      if (this.pending.size === 0) {
        this.idleTimer = setTimeout(() => this.dispose(), IDLE_TIMEOUT_MS);
      }
    });
    worker.on('error', (error: Error) => {
      console.error(`[scanner] The probe worker failed: ${error.message}`);
      this.stop(error);
    });
    worker.on('exit', () => {
      if (this.worker === worker) this.stop(new Error('The probe worker stopped'));
    });
    this.worker = worker;
    return worker;
  }

  private stop(reason: Error): void {
    clearTimeout(this.idleTimer);
    const worker = this.worker;
    this.worker = undefined;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(reason);
    }
    this.pending.clear();
    void worker?.terminate();
  }
}
