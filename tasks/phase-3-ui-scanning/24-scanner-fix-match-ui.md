# FC-24 — Scanner: "Fix Match" UI

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-23 · **Platforms:** desktop

## Goal
Give users a quick way to fix files that were matched wrongly (false positives) or couldn't be parsed/matched
(SRS §3.2 Manual Correction).

## Subtasks
- [ ] "Needs review" tab on the Scanner page listing `unmatched` files (with a count badge in the nav)
- [ ] "Fix Match" dialog for any scanned file (also available on matched ones):
  - [ ] Shows the file path and the parsed title/year
  - [ ] Suggested candidates (poster, title, year, overview) from FC-23
  - [ ] Manual TMDB search with editable title/year and Movie/TV toggle
  - [ ] Confirm → re-links the file: updates/creates the collection item, removes the wrong one if it was only created by this file
- [ ] "Ignore file" / "Ignore folder" actions (status `ignored`, skipped on re-scan)
- [ ] Bulk actions: accept top suggestion for selected files, ignore selected
- [ ] Keyboard-friendly flow (↑/↓ to choose, Enter to confirm, next file opens automatically)
- [ ] From an item's detail page (source = scanner): show linked file paths and a "Fix Match" shortcut

## Acceptance criteria
- A wrongly matched file can be re-matched in ≤ 3 clicks, and the collection updates correctly (no orphaned items).
- Ignored files are not shown again after a re-scan.
