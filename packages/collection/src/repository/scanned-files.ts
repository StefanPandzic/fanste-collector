import { SCAN_MATCH_STATUSES } from '@fanste/core';

import { toCollectionError } from '../errors';

import type { KnownScannedFile, ScanMatchStatus, ScannedFileUpsert } from '@fanste/core';
import type { FansteSupabaseClient, Tables, TablesInsert } from '@fanste/supabase';

/** A `scanned_files` row (FC-21): a video file the desktop scanner found on one device. */
export interface ScannedFile extends KnownScannedFile {
  readonly deviceId: string;
  /** Absolute path with its real case, for display and the filename parser (FC-22). */
  readonly filePath: string;
  readonly parsedTitle: string | null;
  readonly parsedYear: number | null;
  readonly matchConfidence: number | null;
  readonly collectionItemId: string | null;
  /** When the file was last written by a scan, ISO 8601. */
  readonly scannedAt: string;
}

/** The columns `SCANNED_FILE_SELECT` reads. */
type ScannedFileRow = Omit<Tables<'scanned_files'>, 'user_id' | 'parsed_format'>;

const SCANNED_FILE_SELECT =
  'id, device_id, path_key, file_path, file_size, file_modified_at, parsed_title, parsed_year, match_status, match_confidence, collection_item_id, scanned_at, removed_at, subtitle_languages';

/** PostgREST returns at most this many rows per request. */
const PAGE_SIZE = 1000;
/** Rows per write, so a request body stays small. */
const WRITE_CHUNK = 500;
/** IDs per `in.(...)` filter, so the URL stays within limits. */
const ID_CHUNK = 100;

const STATUSES: ReadonlySet<string> = new Set(SCAN_MATCH_STATUSES);

export function toScannedFile(row: ScannedFileRow): ScannedFile {
  return {
    id: row.id,
    deviceId: row.device_id,
    pathKey: row.path_key,
    filePath: row.file_path,
    size: row.file_size,
    modifiedAt: row.file_modified_at,
    parsedTitle: row.parsed_title,
    parsedYear: row.parsed_year,
    matchStatus: STATUSES.has(row.match_status) ? (row.match_status as ScanMatchStatus) : 'pending',
    matchConfidence: row.match_confidence,
    collectionItemId: row.collection_item_id,
    scannedAt: row.scanned_at,
    removedAt: row.removed_at,
    subtitleLanguages: row.subtitle_languages,
  };
}

/** The insert/update row of a planned upsert. A reset sends the match columns back to `pending`. */
export function toScannedFileRow(
  deviceId: string,
  upsert: ScannedFileUpsert,
  scannedAt: string,
): TablesInsert<'scanned_files'> {
  return {
    device_id: deviceId,
    path_key: upsert.pathKey,
    file_path: upsert.filePath,
    file_size: upsert.size,
    file_modified_at: upsert.modifiedAt,
    subtitle_languages: [...upsert.subtitleLanguages],
    scanned_at: scannedAt,
    removed_at: null,
    ...(upsert.resetMatch ? { match_status: 'pending', match_confidence: null } : {}),
  };
}

/**
 * Every `scanned_files` row of a device, removed ones included (a re-scan needs them to tell a
 * returning file from a new one). Ordered by path.
 */
export async function listScannedFiles(
  client: FansteSupabaseClient,
  deviceId: string,
): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('scanned_files')
      .select(SCANNED_FILE_SELECT)
      .eq('device_id', deviceId)
      .order('path_key', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw toCollectionError(error);
    files.push(...data.map(toScannedFile));
    if (data.length < PAGE_SIZE) return files;
  }
}

/**
 * Writes the planned rows (`planScannedFileUpserts`) and returns them as stored. Rows that keep
 * their match status and rows that reset it go in separate requests, because a bulk upsert writes
 * the same columns for every row.
 */
export async function upsertScannedFiles(
  client: FansteSupabaseClient,
  deviceId: string,
  upserts: readonly ScannedFileUpsert[],
  now: Date = new Date(),
): Promise<ScannedFile[]> {
  const scannedAt = now.toISOString();
  const stored: ScannedFile[] = [];
  for (const group of [
    upserts.filter((upsert) => upsert.resetMatch),
    upserts.filter((upsert) => !upsert.resetMatch),
  ]) {
    for (let start = 0; start < group.length; start += WRITE_CHUNK) {
      const rows = group
        .slice(start, start + WRITE_CHUNK)
        .map((upsert) => toScannedFileRow(deviceId, upsert, scannedAt));
      const { data, error } = await client
        .from('scanned_files')
        .upsert(rows, { onConflict: 'user_id,device_id,path_key' })
        .select(SCANNED_FILE_SELECT);
      if (error) throw toCollectionError(error);
      stored.push(...data.map(toScannedFile));
    }
  }
  return stored;
}

/** Marks files as no longer on disk (`removed_at`). Resolves to the time that was set. */
export async function markScannedFilesRemoved(
  client: FansteSupabaseClient,
  ids: readonly string[],
  now: Date = new Date(),
): Promise<string> {
  const removedAt = now.toISOString();
  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    const { error } = await client
      .from('scanned_files')
      .update({ removed_at: removedAt })
      .in('id', ids.slice(start, start + ID_CHUNK));
    if (error) throw toCollectionError(error);
  }
  return removedAt;
}

/** The list with `stored` rows replacing (by `pathKey`) the ones they update; new rows go last. */
export function mergeScannedFiles(
  files: readonly ScannedFile[],
  stored: readonly ScannedFile[],
): ScannedFile[] {
  const byKey = new Map(files.map((file) => [file.pathKey, file]));
  for (const file of stored) byKey.set(file.pathKey, file);
  return [...byKey.values()];
}

/** The list with `removedAt` set on the given files. */
export function markRemovedInList(
  files: readonly ScannedFile[],
  ids: readonly string[],
  removedAt: string,
): ScannedFile[] {
  const removed = new Set(ids);
  return files.map((file) => (removed.has(file.id) ? { ...file, removedAt } : file));
}
