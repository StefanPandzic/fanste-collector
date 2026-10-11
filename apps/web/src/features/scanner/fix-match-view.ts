import { matchQueryOf } from '@fanste/core';

import type { ScannedFile, ScannedFileFixResult } from '@fanste/collection';
import type { ItemRef, MatchCandidate, SearchResult } from '@fanste/core';

/** What the Fix Match dialog (FC-24) shows. Pure, so it is unit-tested. */

/** Search results shown under the suggestions. */
export const MAX_SEARCH_CANDIDATES = 10;

/** A title the user can pick: a stored suggestion (with its confidence) or a search result. */
export interface FixCandidate {
  item: SearchResult;
  /** Set for the matcher's suggestions (FC-23). */
  confidence?: number;
}

/** The ref of a provider result; `undefined` for a custom item (never a TMDB candidate). */
export function candidateRef(item: SearchResult): ItemRef | undefined {
  return item.provider === 'custom'
    ? undefined
    : { provider: item.provider, externalId: item.externalId };
}

export function candidateKey(item: SearchResult): string {
  return `${item.provider}:${item.externalId}`;
}

/**
 * The list to pick from: the stored suggestions first, best first, then the search results that
 * aren't suggestions already (at most `MAX_SEARCH_CANDIDATES`).
 */
export function fixCandidates(
  suggestions: readonly MatchCandidate[] | null,
  searchResults: readonly SearchResult[] | undefined,
): FixCandidate[] {
  const list: FixCandidate[] = (suggestions ?? []).map(({ item, confidence }) => ({
    item,
    confidence,
  }));
  const seen = new Set(list.map(({ item }) => candidateKey(item)));
  const found = (searchResults ?? [])
    .filter((item) => item.provider !== 'custom' && !seen.has(candidateKey(item)))
    .slice(0, MAX_SEARCH_CANDIDATES);
  return [...list, ...found.map((item) => ({ item }))];
}

/** The highlighted index after ↑ (`-1`) or ↓ (`1`), kept inside the list; `-1` for an empty list. */
export function moveIndex(index: number, delta: number, length: number): number {
  if (length === 0) return -1;
  return Math.min(Math.max(0, index + delta), length - 1);
}

/** The manual search a file starts with: its parsed title, year and kind. */
export interface FixSearch {
  title: string;
  year: string;
  kind: 'movie' | 'tv';
}

export function initialSearch(
  file: Pick<ScannedFile, 'filePath' | 'parsedTitle' | 'parsedYear'>,
): FixSearch {
  const match = matchQueryOf(file.filePath);
  return {
    title: match?.query.title ?? file.parsedTitle ?? '',
    year: String(match?.query.year ?? file.parsedYear ?? ''),
    kind: match?.query.kind ?? 'movie',
  };
}

/** The year field as a search filter: a four-digit year, or nothing. */
export function searchYear(value: string): number | undefined {
  const year = Number(value.trim());
  return /^\d{4}$/.test(value.trim()) ? year : undefined;
}

/** `92% match`. */
export function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% match`;
}

/** A Fix Match session: the files to step through (in list order) and where it is. */
export interface FixSession {
  queue: readonly string[];
  currentId: string;
  /** Files handled in this session (fixed with others, or skipped), never opened again. */
  done: readonly string[];
}

/**
 * The session after the current file was handled (`handledIds`: every file the choice changed), or
 * `null` when no file is left: the next file in the queue after the current one, not handled yet.
 */
export function advanceSession(
  session: FixSession,
  handledIds: readonly string[],
): FixSession | null {
  const done = [...new Set([...session.done, session.currentId, ...handledIds])];
  const start = session.queue.indexOf(session.currentId);
  const next = session.queue.slice(start + 1).find((id) => !done.includes(id));
  return next === undefined ? null : { ...session, currentId: next, done };
}

/**
 * The scanner's own copy of the file's current item will be deleted by the fix: the scanner added
 * it and every file linked to it is part of the fix. `linked` is every file linked to that item,
 * removed ones included (the database counts them too).
 */
export function removesCurrentItem({
  itemSource,
  linked,
  fixedIds,
}: {
  itemSource: string | undefined;
  linked: readonly Pick<ScannedFile, 'id'>[];
  fixedIds: readonly string[];
}): boolean {
  return itemSource === 'scanner' && linked.every((file) => fixedIds.includes(file.id));
}

/** The toast after a fix, e.g. `Matched 3 files to Inception · removed 1 wrong item`. */
export function fixSummary(
  kind: 'link' | 'accept' | 'ignore' | 'restore',
  {
    files,
    removedItemIds,
    skipped,
  }: Pick<ScannedFileFixResult, 'files' | 'removedItemIds' | 'skipped'>,
  title?: string,
): string {
  const count = `${files.length.toLocaleString()} ${files.length === 1 ? 'file' : 'files'}`;
  const parts = [
    {
      link: `Matched ${count}${title ? ` to ${title}` : ''}`,
      accept: `Matched ${count}`,
      ignore: `Ignored ${count}`,
      restore: `${count} sent back to matching`,
    }[kind],
  ];
  if (skipped > 0) parts.push(`${skipped.toLocaleString()} had no suggestion to accept`);
  if (removedItemIds.length > 0) {
    parts.push(
      `removed ${removedItemIds.length.toLocaleString()} wrong ${removedItemIds.length === 1 ? 'item' : 'items'}`,
    );
  }
  return parts.join(' · ');
}
