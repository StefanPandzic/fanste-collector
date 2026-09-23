# FC-23 — Scanner: background TMDB matching

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-09, FC-15, FC-21, FC-22 · **Platforms:** desktop

## Goal
Parsed files are quietly matched against TMDB in the background. Confident matches are added to the collection
automatically; uncertain ones are queued for manual review (SRS §3.2).

## Subtasks
- [ ] Gateway `POST /api/match/tmdb` (FC-08): accepts `{ title, year?, kind }[]` in batches (e.g. 20), returns top candidates with scores
- [ ] Scoring: normalized title similarity (e.g. Jaro-Winkler / token overlap), exact-year bonus, ±1 year tolerance, popularity tie-breaker
- [ ] Thresholds (configurable):
  - [ ] `score ≥ 0.85` → auto-match: upsert `collection_items` (`source: 'scanner'`, `format: 'Digital file'`, `details.resolution` / `details.hdr` from the parser via `toCopyDetails`), link `scanned_files.collection_item_id`, status `matched`
- [ ] On re-scan, never overwrite `details` the user has edited by hand (only fill fields that are still empty)
  - [ ] `0.5 ≤ score < 0.85` → status `unmatched` with suggested candidates stored for Fix Match
  - [ ] no result / parse failure → status `unmatched`
- [ ] Dedupe: files that resolve to the same TMDB ID (multiple versions / episodes) link to one collection item per format
- [ ] TV: group episodes by series; add the series once (`tv` category)
- [ ] Background queue in the renderer (or main process) with concurrency limit, pause/resume, persisted progress so a restart continues where it stopped
- [ ] Summary notification: "Added 132 items, 18 need review"
- [ ] Settings: toggle "auto-add confident matches" (off → everything goes to review)

## Acceptance criteria
- Scanning a test library of 200 well-named movies auto-adds ≥ 90% correctly, with no provider rate-limit errors.
- Re-running the scan does not create duplicate collection items.
