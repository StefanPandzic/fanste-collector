# FC-21 — Scanner: directory ingestion (desktop only)

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-03, FC-05 · **Platforms:** Windows, macOS (Electron)

## Goal
Let desktop users pick local folders containing media files and scan them, similar to Jellyfin/Plex (SRS §3.2).

## Subtasks
- [ ] Main-process `ScannerService`:
  - [ ] `selectDirectories()` → native folder picker (`dialog.showOpenDialog`, multi-select)
  - [ ] Recursive walk (`fs.promises.opendir`) run in a worker thread / utility process so the UI never freezes
  - [ ] Video extension allow-list: `.mkv .mp4 .avi .mov .m4v .wmv .ts .webm`; skip samples/trailers (`sample`, `-trailer`) and files < 50 MB (configurable)
  - [ ] Collect path, size, mtime; ignore hidden/system folders
  - [ ] Progress events (files found, current folder) + cancel support
- [ ] Preload bridge (`window.fanste.scanner`): `selectDirectories`, `startScan`, `cancelScan`, `onProgress`, `onFileFound`, `getLibraryFolders`, `removeLibraryFolder`
- [ ] Persist library folders and a stable `device_id` locally (`electron-store`)
- [ ] Incremental re-scan: skip files already in `scanned_files` with unchanged size/mtime; mark removed files
- [ ] Web UI (`/scanner`, desktop only):
  - [ ] Manage library folders (add / remove / rescan)
  - [ ] Scan progress panel
  - [ ] Results table: file name, parsed title/year, match status (feeds FC-23/FC-24)
- [ ] Validate all IPC input in the main process (paths must be inside a user-selected folder)

## Acceptance criteria
- Scanning a folder with 5,000 files completes without freezing the UI and shows live progress.
- Re-scanning only processes new or changed files.
- The scanner page is not reachable in a normal browser.
