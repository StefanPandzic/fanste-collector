# FC-23 — Scanner: background TMDB matching

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-09, FC-15, FC-21, FC-22 · **Platforms:** desktop

## Goal
Parsed files are quietly matched against TMDB in the background. Confident matches are added to the collection
automatically; uncertain ones are queued for manual review (SRS §3.2).

## Subtasks
- [x] Gateway `POST /api/match/tmdb` (FC-08): accepts `{ title, year?, kind }[]` in batches (e.g. 20), returns top candidates with scores
- [x] Scoring: normalized title similarity (e.g. Jaro-Winkler / token overlap), exact-year bonus, ±1 year tolerance, popularity tie-breaker
- [x] Thresholds (configurable):
  - [x] `score ≥ 0.85` → auto-match: upsert `collection_items` (`source: 'scanner'`, `format: 'Digital file'`, `details.resolution` / `details.hdr` from the parser via `toCopyDetails`), link `scanned_files.collection_item_id`, status `matched`
- [x] On re-scan, never overwrite `details` the user has edited by hand (only fill fields that are still empty)
  - [x] `0.5 ≤ score < 0.85` → status `unmatched` with suggested candidates stored for Fix Match (needs a migration: `scanned_files` has no candidates column yet, e.g. `match_candidates jsonb`)
  - [x] no result / parse failure → status `unmatched`
- [x] Dedupe: files that resolve to the same TMDB ID (multiple versions / episodes) link to one collection item per format
- [x] TV: group episodes by series; add the series once (`tv` category)
- [x] Background queue in the renderer (or main process) with concurrency limit, pause/resume, persisted progress so a restart continues where it stopped
- [x] Summary notification: "Added 132 items, 18 need review"
- [x] Settings: toggle "auto-add confident matches" (off → everything goes to review)

## Acceptance criteria
- Scanning a test library of 200 well-named movies auto-adds ≥ 90% correctly, with no provider rate-limit errors.
- Re-running the scan does not create duplicate collection items.

### Implementation notes
- **Scoring** (`packages/core/src/scanner/match-scoring.ts`): confidence = 0.7 · title + 0.3 · year.
  The title part is 1 when the titles are equal after `normalizeTitle` (case, accents, punctuation,
  `&`, sequel numerals, a leading article), otherwise the mean of Jaro-Winkler and shared words, so
  `Alien` / `Aliens` stay apart; the original title counts too. Year: exact 1, ±1 0.8, unknown 0.6,
  else 0. Ties go to the more popular title, but when the runner-up is about as good and not far
  less popular (`Dune` without a year), the tied candidates are held below auto-add. Thresholds are
  `MATCH_THRESHOLDS` (0.85 / 0.5), passed to `scoreCandidates` / `classifyMatch`.
- **Gateway:** `/api/match/tmdb` searches each distinct title once (5 at a time) and returns only
  candidates ≥ 0.5. A title whose search failed comes back `failed: true` (the file stays `pending`).
- **Migration** `20261010143324_scanner_matching.sql`: `scanned_files.match_candidates` (≤ 5
  `{ item, confidence }`, also kept for matched files), `set_scan_matches` (bulk result write that only
  changes `pending` rows, so FC-24 choices are never overwritten) and `set_scanner_settings`
  (`profiles.preferences.scanner.autoAdd`, default on).
- **Queue** (`@fanste/collection`, `createScanMatchRunner` / `useScanMatcher`): the persisted queue is
  the device's `pending` rows. Per 20 titles: one match call and one `/api/items/batch` call (fills
  `metadata_cache`), at least 1.5 s apart, retrying a 429 after its `Retry-After` (now on
  `ApiClientError.retryAfterSeconds`). 200 movies ≈ 20 gateway calls. Three batches in a row
  whose searches all fail end the run; the files are tried on the next one.
- **Copies:** one `Digital file` copy per TMDB ID (several versions of a movie, or a show's
  episodes, are one copy): the best version's details (`toCopyDetails`), the provider's original
  language, and for TV the scanned episodes as owned seasons. The insert targets the one-copy-per-format
  constraint (`ignoreDuplicates`), so re-runs never duplicate. An existing copy only gets its empty
  fields filled; new episodes are added to its seasons (nothing removed).
- **UI:** `ScanMatcherProvider` in the `(app)` layout runs matching on every page of the desktop
  app; the scanner page shows progress with Pause/Resume and the auto-add setting (also in
  Settings → Scanner). A run ends with a toast like "Added 132 items, 18 need review".
- **Where a detail came from** (asked for during review): when the scanner adds or fills a copy it
  records the values it read from the file's own headers in `collection_items.file_details`
  (migration `20261011083705_copy_file_details.sql`, plus `merge_item_file_details` for fills). The
  item page marks a detail "from file" while it still has that value, and "edited" with a reset to
  the file's value once the user changes it, like the TMDB overrides. Values guessed from the file
  name (or mixed with sidecar subtitle files) aren't recorded. Copies scanned before this have no
  markers.
- Not done: files that were already matched but changed on disk aren't matched again (Fix Match,
  FC-24, covers corrections). The 200-movie criterion is covered with scoring tests; a live run
  on a real library is still open.
