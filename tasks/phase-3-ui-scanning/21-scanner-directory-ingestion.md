# FC-21 — Scanner: directory ingestion (desktop only)

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-03, FC-05 · **Platforms:** Windows, macOS (Electron)

## Goal
Let desktop users pick local folders containing media files and scan them, similar to Jellyfin/Plex (SRS §3.2).

## Subtasks
- [x] Main-process `ScannerService`:
  - [x] `selectDirectories()` → native folder picker (`dialog.showOpenDialog`, multi-select)
  - [x] Recursive walk (`fs.promises.opendir`) run in a worker thread / utility process so the UI never freezes
  - [x] Video extension allow-list: `.mkv .mp4 .avi .mov .m4v .wmv .ts .webm`; skip samples/trailers (`sample`, `-trailer`) and files < 50 MB (configurable)
  - [x] Collect path, size, mtime; ignore hidden/system folders
  - [x] Collect sidecar subtitle files next to each video (`.srt .ass .ssa .sub .idx .vtt`) and read the language from the name (`Movie.en.srt`, `Movie.srp.forced.srt`) for FC-15 `subtitleLanguages`
  - [x] Progress events (files found, current folder) + cancel support
- [x] Preload bridge (`window.fanste.scanner`): `selectDirectories`, `startScan`, `cancelScan`, `onProgress`, `onFileFound`, `getLibraryFolders`, `removeLibraryFolder`
- [x] Persist library folders and a stable `device_id` locally (`electron-store`)
- [x] Incremental re-scan: skip files already in `scanned_files` with unchanged size/mtime; mark removed files
- [x] Web UI (`/scanner`, desktop only):
  - [x] Manage library folders (add / remove / rescan)
  - [x] Scan progress panel
  - [x] Results table: file name, parsed title/year, match status (feeds FC-23/FC-24)
- [x] Validate all IPC input in the main process (paths must be inside a user-selected folder)

## Acceptance criteria
- Scanning a folder with 5,000 files completes without freezing the UI and shows live progress.
- Re-scanning only processes new or changed files.
- The scanner page is not reachable in a normal browser.

## Notes
- `scanned_files` (FC-05) already has `file_modified_at` (for incremental re-scans) and `removed_at` (for removed files).
- `unique (user_id, device_id, file_path)` is case-sensitive, but Windows and default macOS file systems aren't: normalize the path (separators, and case on case-insensitive volumes) before the upsert.

### Implementation notes
- **Who writes what:** the main process only reads the disk; the renderer (which holds the Supabase session)
  writes `scanned_files` through `@fanste/collection` (`useScannedFileSync`), so RLS applies and no token
  crosses IPC.
- **Migration** `20261010114825_scanner_ingestion.sql`: `path_key` (the normalized path, `toPathKey` in
  `@fanste/core`: `/` separators and lowercased on Windows, lowercased on macOS, NFC) carries the unique
  constraint, so `file_path` keeps the real case for display and FC-22. `subtitle_languages text[]` holds the
  sidecar languages for FC-23 (`details.subtitleLanguages`). Length checks on the path and device ID.
- **Local state** is a validated JSON file, `<userData>/scanner.json` (`deviceId` + library folders), like
  `window-state.json`, instead of `electron-store`: no new dependency, and it is unit-tested.
- **Bridge:** `getDeviceId`, `getLibraryFolders`, `selectDirectories` (picks and adds), `removeLibraryFolder`,
  `startScan({ folders?, minFileSizeMb? })` → `ScanResult`, `cancelScan`, `onScanProgress` and
  `onFilesFound` (batches of ~200 files or every 250 ms, not one event per file).
- **Validation:** every path from the renderer must be absolute; it is resolved (`..`), canonicalized
  (`realpath.native`) and must be a library folder or inside one. Library folders come only from the native
  dialog. The walk doesn't follow symbolic links.
- **Incremental re-scan:** `planScannedFileUpserts` writes only new, changed (size/mtime), returning or
  subtitle-changed files. Only new files start as `pending`; a known file keeps its match status and item
  link when it changes (an `unmatched` row must stay so, see the FC-05 unlink trigger). FC-23 can compare
  `scanned_at` with its own runs to look at changed files again. Videos below the minimum size are reported as
  `tooSmallKeys`, so raising the size never marks files that are still on disk as removed.
  `findRemovedFiles` marks missing files `removed_at`, but only in folders the scan read completely, so a
  cancelled scan or an unplugged drive never removes anything. Removing a library folder marks its files
  removed too (except files another library folder still covers).
- **Minimum size:** 50 MB by default, chosen on the page (0–700 MB), saved in `localStorage`.
- **Performance:** the built worker walks 5,000 files in 250 folders in ~0.4 s and sends 32 messages. The
  results table renders 100 rows per page.
- **Parsed title/year** stays `—` until FC-22 fills `parsed_title` / `parsed_year`.
