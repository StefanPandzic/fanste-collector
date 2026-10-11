# FC-24 — Scanner: "Fix Match" UI

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-23 · **Platforms:** desktop

## Goal
Give users a quick way to fix files that were matched wrongly (false positives) or couldn't be parsed/matched
(SRS §3.2 Manual Correction).

## Subtasks
- [x] "Needs review" tab on the Scanner page listing `unmatched` files (with a count badge in the nav)
- [x] "Fix Match" dialog for any scanned file (also available on matched ones):
  - [x] Shows the file path and the parsed title/year
  - [x] Suggested candidates (poster, title, year, overview) from FC-23
  - [x] Manual TMDB search with editable title/year and Movie/TV toggle
  - [x] Confirm → re-links the file: updates/creates the collection item, removes the wrong one if it was only created by this file
- [x] "Ignore file" / "Ignore folder" actions (status `ignored`, skipped on re-scan)
- [x] Bulk actions: accept top suggestion for selected files, ignore selected
- [x] Keyboard-friendly flow (↑/↓ to choose, Enter to confirm, next file opens automatically)
- [x] From an item's detail page (source = scanner): show linked file paths and a "Fix Match" shortcut

## Acceptance criteria
- A wrongly matched file can be re-matched in ≤ 3 clicks, and the collection updates correctly (no orphaned items).
- Ignored files are not shown again after a re-scan.

### Implementation notes
- **Migration** `20261011091204_scanner_fix_match.sql`: `relink_scanned_files(p_ids, p_status,
  p_item_id)` stores the user's choice in one transaction: `manual` links the files to a copy,
  `ignored` unlinks them and keeps them out of matching, `pending` hands them back to the matcher.
  It changes files in any status (the user's choice wins over `set_scan_matches`). Then every item the
  files were linked to before is deleted if the scanner added it (`source = 'scanner'`) and no scanned
  file on any device (removed ones included) links to it any more, so no orphaned items are left.
- **Which files a fix covers** (`@fanste/core` `scanner/fix-match.ts`): `fixGroup` is the file plus the
  device's other current, not ignored files with the same `matchQueryOf` key (what the matcher would
  have grouped, e.g. a show's episodes) and the same linked item. The dialog applies the fix to all of
  them by default ("Also fix N other files of this title"). `topSuggestionGroups` groups a selection
  by its best stored candidate for "Accept top suggestion".
- **Data** (`@fanste/collection`): `linkFilesToItem` finds or adds the `Digital file` copy like the
  background matcher (`scannedCopyInput`, `fillEmptyDetails`, `file_details`), then calls the RPC.
  `useFixScannedFiles` applies `link` / `accept` / `ignore` / `restore` and updates the device lists;
  `useItemScannedFiles` gives the item page its files.
- **UI:** the results table opens on "Needs review" while there is something to review, ignored files
  show only under "Ignored", rows can be selected (bulk accept, ignore, match again) and each row has
  "Fix match". The dialog shows the stored suggestions and a manual TMDB search (title, year,
  Movie/TV), with overviews from one batch call; ↑/↓ choose, Enter confirms, the next file of the list
  opens on its own, and "Skip" moves on without a change. The Scanner nav entry shows the review count.
  The item page lists its linked files with "Fix match"; when a fix deletes the item, the page follows
  the files to their new item.
- **Ignore folder** is a one-time action (the user's choice): it ignores the current files in the
  file's folder and its subfolders. Files added there later are matched as usual. Ignored files stay
  ignored on re-scans, because a re-scan never resets a known file's match status.
- **Ignoring a matched file** unlinks it, and its item is removed under the same rule as a re-link.
