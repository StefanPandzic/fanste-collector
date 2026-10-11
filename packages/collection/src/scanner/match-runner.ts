import { ApiClientError } from '@fanste/api-client';
import {
  classifyMatch,
  fillEmptyDetails,
  groupForMatching,
  MAX_MATCH_QUERIES,
  scannedCopyInput,
  scannedFileDetails,
} from '@fanste/core';

import { refKey } from '../repository/copies';
import {
  addScannedCopies,
  fillScannedCopyDetails,
  findScannedCopies,
  saveScanMatches,
} from '../repository/scan-matching';

import type { ScanMatch, ScannedCopyInsert } from '../repository/scan-matching';
import type { ScannedFile } from '../repository/scanned-files';
import type { ApiClient } from '@fanste/api-client';
import type {
  ItemRef,
  MatchGroup,
  MatchResponse,
  NormalizedItem,
  ParsedFile,
  ScannerSettings,
} from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

// The scanner's background matching (FC-23). The queue is the device's `pending` files in
// `scanned_files`, so a run that stops (pause, app closed, error) continues from where it was the
// next time: only files whose result was stored leave the queue.

/** Least time between two gateway calls, so a large library stays well inside the user's limit. */
export const MATCH_REQUEST_GAP_MS = 1500;
/** Times a call that got `rate_limited` is retried, after the gateway's `Retry-After`. */
const RATE_LIMIT_RETRIES = 3;
const DEFAULT_RETRY_AFTER_S = 30;
/** Batches in a row whose provider calls all failed before the run gives up until next time. */
const MAX_FAILED_BATCHES = 3;

export interface ScanMatchProgress {
  status: 'idle' | 'running' | 'paused';
  /** Files of this run handled so far, and in all. */
  done: number;
  total: number;
  /** Copies added to the collection, and files left for review, in this run. */
  added: number;
  review: number;
}

/** What a finished run did. */
export interface ScanMatchSummary {
  added: number;
  review: number;
  /** Files still `pending` (the provider couldn't be asked); tried again on the next run. */
  remaining: number;
  /** Set when the run stopped early because of an error. */
  error?: unknown;
}

export interface ScanMatchRunnerDeps {
  client: FansteSupabaseClient;
  api: ApiClient;
  /** The device's files waiting to be matched: `pending` and still on disk. */
  pendingFiles: () => readonly ScannedFile[];
  settings: () => Promise<ScannerSettings>;
  /** Rows whose match result was stored, to update cached lists. */
  onFilesStored: (files: ScannedFile[]) => void;
  /** Copies were added or changed. */
  onCollectionChanged: () => void;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  requestGapMs?: number;
}

export interface ScanMatchRunner {
  /** Starts a run, or when one is running, runs again once it ends (for files added meanwhile). */
  start: () => void;
  /** Holds the run after the current batch. */
  pause: () => void;
  resume: () => void;
  /** Ends the run after the current batch (e.g. on sign-out); `start` begins a new one. */
  stop: () => void;
  getProgress: () => ScanMatchProgress;
  /** Calls `listener` when the progress changes. */
  subscribe: (listener: () => void) => () => void;
  /** Calls `listener` when a run ends (not for a run that had nothing to match). */
  onFinished: (listener: (summary: ScanMatchSummary) => void) => () => void;
}

const IDLE: ScanMatchProgress = { status: 'idle', done: 0, total: 0, added: 0, review: 0 };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One query's answer and the files it covers. */
interface GroupResult {
  group: MatchGroup<ScannedFile>;
  result: MatchResponse['results'][number];
  decision: ReturnType<typeof classifyMatch>;
}

function bestRef(result: GroupResult): ItemRef | undefined {
  const best = result.result.candidates[0]?.item;
  if (!best || best.provider === 'custom') return undefined;
  return { provider: best.provider, externalId: best.externalId };
}

function unmatched(file: ScannedFile, result?: GroupResult['result']): ScanMatch {
  return {
    id: file.id,
    status: 'unmatched',
    confidence: result?.candidates[0]?.confidence ?? null,
    candidates: result?.candidates ?? [],
    collectionItemId: null,
  };
}

export function createScanMatchRunner(deps: ScanMatchRunnerDeps): ScanMatchRunner {
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;
  const gap = deps.requestGapMs ?? MATCH_REQUEST_GAP_MS;

  let progress: ScanMatchProgress = IDLE;
  const listeners = new Set<() => void>();
  const finishListeners = new Set<(summary: ScanMatchSummary) => void>();
  let running = false;
  let again = false;
  let paused = false;
  let stopped = false;
  let resumeRun: (() => void) | undefined;
  /** Cuts a `Retry-After` wait short when the run is stopped. */
  let interruptWait: (() => void) | undefined;
  let lastCall = Number.NEGATIVE_INFINITY;

  function update(next: Partial<ScanMatchProgress>) {
    progress = { ...progress, ...next };
    for (const listener of listeners) listener();
  }

  /** A gateway call, spaced from the last one and retried after a `rate_limited` answer. */
  async function gateway<T>(call: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = lastCall + gap - now();
      if (wait > 0) await sleep(wait);
      lastCall = now();
      try {
        return await call();
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          error.code === 'rate_limited' &&
          attempt < RATE_LIMIT_RETRIES
        ) {
          await Promise.race([
            sleep((error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_S) * 1000),
            new Promise<void>((resolve) => {
              interruptWait = resolve;
            }),
          ]);
          interruptWait = undefined;
          if (stopped) throw error;
          continue;
        }
        throw error;
      }
    }
  }

  async function waitWhilePaused() {
    while (paused && !stopped) {
      await new Promise<void>((resolve) => {
        resumeRun = resolve;
      });
    }
  }

  /**
   * Matches one batch of queries and stores the results. Resolves to `false` when the provider
   * couldn't be asked: every search failed, or the confident matches' metadata didn't load.
   */
  async function matchBatch(
    groups: MatchGroup<ScannedFile>[],
    { autoAdd }: ScannerSettings,
  ): Promise<boolean> {
    let response: MatchResponse;
    try {
      response = await gateway(() => deps.api.matchTmdb(groups.map((group) => group.query)));
    } catch (error) {
      if (error instanceof ApiClientError && error.code !== 'unauthorized') return false;
      throw error;
    }
    const results: GroupResult[] = groups.map((group, index) => {
      const result = response.results[index] ?? { candidates: [], failed: true };
      return { group, result, decision: classifyMatch(result.candidates, { autoAdd }) };
    });

    // Load the confident matches' metadata in one call (it also fills the shared cache).
    const confident = results.filter(
      (entry) => !entry.result.failed && entry.decision === 'matched',
    );
    const refs = [
      ...new Map(
        confident.flatMap((entry) => {
          const ref = bestRef(entry);
          return ref ? [[refKey(ref), ref] as const] : [];
        }),
      ).values(),
    ];
    const items = new Map<string, NormalizedItem>();
    const notFound = new Set<string>();
    let metadataFailed = false;
    if (refs.length > 0) {
      try {
        const batch = await gateway(() => deps.api.getItemsBatch(refs));
        for (const item of batch.items) {
          if (item.provider === 'custom') continue;
          items.set(refKey({ provider: item.provider, externalId: item.externalId }), item);
        }
        for (const missing of batch.missing) {
          if (missing.reason === 'not_found') notFound.add(refKey(missing));
        }
      } catch (error) {
        // Like `retry_later`: the confident files stay pending, the others are stored.
        if (!(error instanceof ApiClientError) || error.code === 'unauthorized') throw error;
        metadataFailed = true;
      }
    }

    // One copy per item: files of several queries can resolve to the same title.
    const filesByRef = new Map<string, ParsedFile<ScannedFile>[]>();
    for (const entry of confident) {
      const ref = bestRef(entry);
      if (!ref || !items.has(refKey(ref))) continue;
      const key = refKey(ref);
      filesByRef.set(key, [...(filesByRef.get(key) ?? []), ...entry.group.files]);
    }

    let copies = await findScannedCopies(deps.client, refs);
    const inserts: ScannedCopyInsert[] = [];
    let changed = false;
    for (const [key, files] of filesByRef) {
      const item = items.get(key)!;
      const copy = copies.get(key);
      const input = scannedCopyInput(item, files);
      const scanned = input.details ?? {};
      if (!copy) {
        // Only what came from the file's own headers is recorded as "from file".
        inserts.push({ input, fileDetails: scannedFileDetails(files, scanned) });
        continue;
      }
      const patch = fillEmptyDetails(copy.category, copy.details, scanned);
      if (Object.keys(patch).length > 0) {
        await fillScannedCopyDetails(
          deps.client,
          copy.id,
          copy.category,
          patch,
          scannedFileDetails(files, patch),
        );
        changed = true;
      }
    }
    if (inserts.length > 0) {
      const added = await addScannedCopies(deps.client, inserts);
      update({ added: progress.added + added });
      changed = true;
      copies = await findScannedCopies(deps.client, refs);
    }

    const matches: ScanMatch[] = [];
    for (const entry of results) {
      if (entry.result.failed) continue;
      const ref = entry.decision === 'matched' ? bestRef(entry) : undefined;
      const copyId = ref ? copies.get(refKey(ref))?.id : undefined;
      for (const { file } of entry.group.files) {
        if (copyId) {
          matches.push({
            id: file.id,
            status: 'matched',
            confidence: entry.result.candidates[0]?.confidence ?? null,
            candidates: entry.result.candidates,
            collectionItemId: copyId,
          });
        } else if (!ref || notFound.has(refKey(ref))) {
          matches.push(unmatched(file, entry.result));
        }
        // Otherwise the metadata comes later (`retry_later`): the file stays pending.
      }
    }
    await store(matches);
    if (changed) deps.onCollectionChanged();
    return !metadataFailed && results.some((entry) => !entry.result.failed);
  }

  async function store(matches: ScanMatch[]) {
    if (matches.length === 0) return;
    const stored = await saveScanMatches(deps.client, matches);
    deps.onFilesStored(stored);
    update({
      review: progress.review + stored.filter((file) => file.matchStatus === 'unmatched').length,
    });
  }

  async function runOnce(): Promise<void> {
    const files = deps.pendingFiles();
    if (files.length === 0) return;
    const { groups, unparsed } = groupForMatching(files);
    update({ status: paused ? 'paused' : 'running', done: 0, total: files.length });

    await store(unparsed.map((file) => unmatched(file)));
    update({ done: unparsed.length });

    let failedInRow = 0;
    for (let start = 0; start < groups.length && !stopped; start += MAX_MATCH_QUERIES) {
      await waitWhilePaused();
      if (stopped) break;
      const batch = groups.slice(start, start + MAX_MATCH_QUERIES);
      // Read for every batch, so turning auto-add off takes effect during a run.
      const settings = await deps.settings();
      failedInRow = (await matchBatch(batch, settings)) ? 0 : failedInRow + 1;
      update({ done: progress.done + batch.reduce((sum, group) => sum + group.files.length, 0) });
      if (failedInRow >= MAX_FAILED_BATCHES) break;
    }
  }

  async function run() {
    // Nothing to do: don't show a run at all.
    if (deps.pendingFiles().length === 0) return;
    running = true;
    stopped = false;
    lastCall = Number.NEGATIVE_INFINITY;
    update({ ...IDLE, status: paused ? 'paused' : 'running' });
    let error: unknown;
    try {
      do {
        again = false;
        await runOnce();
      } while (again && !stopped);
    } catch (caught) {
      error = caught;
    }
    running = false;
    const { added, review, total } = progress;
    const remaining = deps.pendingFiles().length;
    update({ ...IDLE });
    if (total > 0 || error !== undefined) {
      const summary = { added, review, remaining, ...(error !== undefined ? { error } : {}) };
      for (const listener of finishListeners) listener(summary);
    }
  }

  return {
    start() {
      if (running) {
        stopped = false;
        again = true;
        return;
      }
      void run();
    },
    pause() {
      paused = true;
      if (running) update({ status: 'paused' });
    },
    resume() {
      paused = false;
      if (running) update({ status: 'running' });
      resumeRun?.();
      resumeRun = undefined;
    },
    stop() {
      stopped = true;
      again = false;
      resumeRun?.();
      resumeRun = undefined;
      interruptWait?.();
      interruptWait = undefined;
    },
    getProgress: () => progress,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onFinished(listener) {
      finishListeners.add(listener);
      return () => finishListeners.delete(listener);
    },
  };
}
