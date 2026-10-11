import {
  addItemInputSchema,
  detailsPatchSchemaFor,
  parseFileDetails,
  parseScannerSettings,
  SCANNED_FORMAT,
  scannerSettingsSchema,
} from '@fanste/core';

import { toCollectionError } from '../errors';
import { refKey } from './copies';
import { toInsertRow } from './mappers';
import { SCANNED_FILE_SELECT, toScannedFile } from './scanned-files';

import type { ScannedFile } from './scanned-files';
import type {
  AddItemInput,
  FileDetails,
  ItemCategory,
  ItemRef,
  Json,
  MatchCandidate,
  ScannerSettings,
} from '@fanste/core';
import type { FansteSupabaseClient } from '@fanste/supabase';

// The writes of the scanner's background matching (FC-23): the `Digital file` copies it adds or
// fills, the match results of the files, and the scanner settings.

/** External IDs per request, so the `in.(...)` filter stays well within URL limits. */
const LOOKUP_CHUNK = 100;

/** A `Digital file` copy the user already has of a matched item. */
export interface ScannedCopy {
  id: string;
  category: ItemCategory;
  /** Stored `details`, unparsed. */
  details: unknown;
}

/** The user's `Digital file` copies of the given items, keyed by `refKey`. */
export async function findScannedCopies(
  client: FansteSupabaseClient,
  refs: readonly ItemRef[],
): Promise<Map<string, ScannedCopy>> {
  const copies = new Map<string, ScannedCopy>();
  const ids = [
    ...new Set(refs.filter((ref) => ref.provider === 'tmdb').map((ref) => ref.externalId)),
  ];
  for (let start = 0; start < ids.length; start += LOOKUP_CHUNK) {
    const { data, error } = await client
      .from('collection_items')
      .select('id, category, external_id, details')
      .eq('provider', 'tmdb')
      // The key the one-copy-per-format constraint uses, so `digital file` counts too.
      .eq('format_key', SCANNED_FORMAT.toLowerCase())
      .in('external_id', ids.slice(start, start + LOOKUP_CHUNK));
    if (error) throw toCollectionError(error);
    for (const row of data) {
      if (row.external_id === null) continue;
      copies.set(refKey({ provider: 'tmdb', externalId: row.external_id }), {
        id: row.id,
        category: row.category,
        details: row.details,
      });
    }
  }
  return copies;
}

/** A copy the scanner adds, with the values it took from the file's own headers. */
export interface ScannedCopyInsert {
  input: AddItemInput;
  /** Recorded in `file_details` (`scannedFileDetails`), so the item page can mark them. */
  fileDetails: FileDetails;
}

/**
 * Adds the scanner's new copies. A copy that exists by now (another device added it) is skipped,
 * never duplicated: the insert targets the one-copy-per-format constraint. Resolves to how many
 * copies were added.
 */
export async function addScannedCopies(
  client: FansteSupabaseClient,
  copies: readonly ScannedCopyInsert[],
): Promise<number> {
  if (copies.length === 0) return 0;
  let rows;
  try {
    rows = copies.map(({ input, fileDetails }) => ({
      ...toInsertRow(addItemInputSchema.parse(input)),
      file_details: parseFileDetails(fileDetails),
    }));
  } catch (error) {
    throw toCollectionError(error);
  }
  const { data, error } = await client
    .from('collection_items')
    .upsert(rows, {
      onConflict: 'user_id,provider,external_id,format_key',
      ignoreDuplicates: true,
    })
    .select('id');
  if (error) throw toCollectionError(error);
  return data.length;
}

/**
 * Merges scanned details into an existing copy (`fillEmptyDetails` builds the patch, so nothing the
 * user set is overwritten). Merged in the database, like the item page's edits. `fileDetails`, the
 * patched values that came from the file's own headers, are added to the copy's `file_details`.
 */
export async function fillScannedCopyDetails(
  client: FansteSupabaseClient,
  id: string,
  category: ItemCategory,
  patch: Record<string, unknown>,
  fileDetails: FileDetails = {},
): Promise<void> {
  let parsed: Record<string, unknown>;
  try {
    parsed = detailsPatchSchemaFor(category).parse(patch);
  } catch (error) {
    throw toCollectionError(error);
  }
  if (Object.keys(parsed).length === 0) return;
  const { error } = await client.rpc('merge_item_details', {
    p_id: id,
    p_category: category,
    p_patch: parsed as Json,
  });
  if (error) throw toCollectionError(error);

  const recorded = parseFileDetails(fileDetails);
  if (Object.keys(recorded).length === 0) return;
  const merged = await client.rpc('merge_item_file_details', {
    p_id: id,
    p_values: recorded as Json,
  });
  if (merged.error) throw toCollectionError(merged.error);
}

/**
 * The copy details the scanner took from the item's file headers (`file_details`, FC-23): what the
 * item page marks "from file", or "edited" once changed. `{}` for copies the scanner didn't fill.
 */
export async function getItemFileDetails(
  client: FansteSupabaseClient,
  itemId: string,
): Promise<FileDetails> {
  const { data, error } = await client
    .from('collection_items')
    .select('file_details')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw toCollectionError(error);
  return parseFileDetails(data?.file_details);
}

/** The result of matching one scanned file. */
export interface ScanMatch {
  id: string;
  /** `matched` links the file to `collectionItemId`; `unmatched` leaves it for review (FC-24). */
  status: 'matched' | 'unmatched';
  /** Of the best candidate; `null` when there was none. */
  confidence: number | null;
  candidates: readonly MatchCandidate[];
  collectionItemId: string | null;
}

/** Match results per request, so the body stays small. */
const MATCH_WRITE_CHUNK = 200;

/**
 * Stores match results. Only files that are still `pending` change, so a choice the user made
 * meanwhile stays. Resolves to the rows written.
 */
export async function saveScanMatches(
  client: FansteSupabaseClient,
  matches: readonly ScanMatch[],
): Promise<ScannedFile[]> {
  const stored: ScannedFile[] = [];
  for (let start = 0; start < matches.length; start += MATCH_WRITE_CHUNK) {
    const payload = matches.slice(start, start + MATCH_WRITE_CHUNK).map((match) => ({
      id: match.id,
      match_status: match.status,
      match_confidence: match.confidence,
      match_candidates: match.candidates,
      collection_item_id: match.collectionItemId,
    }));
    const { data, error } = await client
      .rpc('set_scan_matches', { p_matches: payload as unknown as Json })
      .select(SCANNED_FILE_SELECT);
    if (error) throw toCollectionError(error);
    stored.push(...data.map(toScannedFile));
  }
  return stored;
}

/** The user's scanner settings (`profiles.preferences.scanner`), with defaults filled in. */
export async function getScannerSettings(client: FansteSupabaseClient): Promise<ScannerSettings> {
  // RLS limits `profiles` to the caller's own row.
  const { data, error } = await client.from('profiles').select('preferences').maybeSingle();
  if (error) throw toCollectionError(error);
  return parseScannerSettings(data?.preferences);
}

export async function saveScannerSettings(
  client: FansteSupabaseClient,
  settings: ScannerSettings,
): Promise<void> {
  let parsed: ScannerSettings;
  try {
    parsed = scannerSettingsSchema.parse(settings);
  } catch (error) {
    throw toCollectionError(error);
  }
  const { error } = await client.rpc('set_scanner_settings', { p_settings: parsed as Json });
  if (error) throw toCollectionError(error);
}
