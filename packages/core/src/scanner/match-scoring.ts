import type { MatchCandidate, MatchQuery } from '../gateway/requests';
import type { SearchResult } from '../models/search';

// Scores TMDB search results against a scanned file's parsed title and year (FC-23). The gateway
// scores the candidates; the scanner decides with `classifyMatch` what to do with the best one.

/** A provider search result to score, with what the score is based on. */
export interface ScoringCandidate {
  item: SearchResult;
  /** Provider popularity, the tie-breaker between equally good titles. */
  popularity: number;
  /** The title in the original language, when the provider has one. */
  originalTitle?: string;
}

/** Where the scanner draws its lines. Both are confidences from 0 to 1. */
export interface MatchThresholds {
  /** At or above: added to the collection automatically (when auto-add is on). */
  autoAdd: number;
  /** At or above (and below `autoAdd`): suggested for review. Below: no match. */
  review: number;
}

export const MATCH_THRESHOLDS: MatchThresholds = { autoAdd: 0.85, review: 0.5 };

/** Candidates kept per file, for the "Fix Match" suggestions (FC-24). */
export const MAX_STORED_CANDIDATES = 5;

const TITLE_WEIGHT = 0.7;
const YEAR_WEIGHT = 0.3;
/** Year score when the file or the candidate has no year: neither confirms nor rules out. */
const UNKNOWN_YEAR_SCORE = 0.6;
/** Year score when the years are one apart (release dates differ between countries). */
const NEAR_YEAR_SCORE = 0.8;
/** Two candidates closer than this are a tie... */
const TIE_MARGIN = 0.05;
/** ...unless the more popular one is at least this many times as popular. */
const POPULARITY_LEAD = 2;

// Roman numerals of sequels, so `Rocky II` and `Rocky 2` compare equal. `I`, `V` and `X` are left
// alone: they are also words and letters (`V for Vendetta`, `X-Men`).
const ROMAN_NUMERALS: Record<string, string> = {
  ii: '2',
  iii: '3',
  iv: '4',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
};

const LEADING_ARTICLE = /^(the|a|an) /;

/**
 * A title reduced to what matters for comparing: lowercase, no accents or punctuation, `&` as `and`,
 * sequel numerals as digits and no leading article (`The Matrix` → `matrix`).
 */
export function normalizeTitle(title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((word) => word !== '')
    .map((word) => ROMAN_NUMERALS[word] ?? word);
  return words.join(' ').replace(LEADING_ARTICLE, '');
}

/** Jaro-Winkler similarity of two strings, from 0 (nothing alike) to 1 (equal). */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const end = Math.min(i + window + 1, b.length);
    for (let j = Math.max(0, i - window); j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[j]) j++;
    if (a[i] !== b[j]) transpositions++;
    j++;
  }
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Share of words two normalized titles have in common (Dice coefficient). */
function wordOverlap(a: string, b: string): number {
  const aWords = new Set(a.split(' '));
  const bWords = new Set(b.split(' '));
  let shared = 0;
  for (const word of aWords) if (bWords.has(word)) shared++;
  return (2 * shared) / (aWords.size + bWords.size);
}

/**
 * How alike two titles are, from 0 to 1: equal after `normalizeTitle` is 1; otherwise the mean of
 * the character similarity (catches typos) and the shared words (so `Alien` and `Aliens`, close in
 * characters, aren't taken for the same film).
 */
export function titleSimilarity(a: string, b: string): number {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (left === '' || right === '') return 0;
  if (left === right) return 1;
  return (jaroWinkler(left, right) + wordOverlap(left, right)) / 2;
}

function yearScore(fileYear: number | undefined, releaseYear: number | undefined): number {
  if (fileYear === undefined || releaseYear === undefined) return UNKNOWN_YEAR_SCORE;
  const apart = Math.abs(fileYear - releaseYear);
  if (apart === 0) return 1;
  return apart === 1 ? NEAR_YEAR_SCORE : 0;
}

/** The confidence of one candidate, from the title (and original title) and the year. */
export function scoreCandidate(query: MatchQuery, candidate: ScoringCandidate): number {
  const title = Math.max(
    titleSimilarity(query.title, candidate.item.title),
    candidate.originalTitle ? titleSimilarity(query.title, candidate.originalTitle) : 0,
  );
  const year = yearScore(query.year, candidate.item.releaseYear);
  return Math.round((TITLE_WEIGHT * title + YEAR_WEIGHT * year) * 1000) / 1000;
}

/**
 * The candidates with their confidence, best first; equal scores go to the more popular title. When
 * the runner-up is about as good and about as popular (`Dune` without a year: 1984 or 2021?), the
 * best one is held below `autoAdd`, so a person decides. Candidates below `review` are dropped.
 */
export function scoreCandidates(
  query: MatchQuery,
  candidates: readonly ScoringCandidate[],
  thresholds: MatchThresholds = MATCH_THRESHOLDS,
): MatchCandidate[] {
  const scored = candidates
    .map((candidate) => ({ candidate, confidence: scoreCandidate(query, candidate) }))
    .sort((a, b) => b.confidence - a.confidence || b.candidate.popularity - a.candidate.popularity);

  const [best, runnerUp] = scored;
  if (
    best &&
    runnerUp &&
    best.confidence - runnerUp.confidence < TIE_MARGIN &&
    best.candidate.popularity < runnerUp.candidate.popularity * POPULARITY_LEAD
  ) {
    // Every tied candidate, so the order stays the same.
    const cap = Math.round((thresholds.autoAdd - 0.01) * 1000) / 1000;
    const tieFloor = best.confidence - TIE_MARGIN;
    for (const entry of scored) {
      if (entry.confidence > tieFloor) entry.confidence = Math.min(entry.confidence, cap);
    }
  }

  return scored
    .filter(({ confidence }) => confidence >= thresholds.review)
    .slice(0, MAX_STORED_CANDIDATES)
    .map(({ candidate, confidence }) => ({ item: candidate.item, confidence }));
}

/**
 * What the scanner does with a file, from its candidates (best first):
 * - `matched`: add it to the collection; only when auto-add is on.
 * - `review`: suggest the candidates and let the user pick (FC-24).
 * - `none`: nothing good enough was found.
 */
export type MatchDecision = 'matched' | 'review' | 'none';

export function classifyMatch(
  candidates: readonly MatchCandidate[],
  {
    autoAdd = true,
    thresholds = MATCH_THRESHOLDS,
  }: { autoAdd?: boolean; thresholds?: MatchThresholds } = {},
): MatchDecision {
  const best = candidates[0];
  if (!best || best.confidence < thresholds.review) return 'none';
  return autoAdd && best.confidence >= thresholds.autoAdd ? 'matched' : 'review';
}
