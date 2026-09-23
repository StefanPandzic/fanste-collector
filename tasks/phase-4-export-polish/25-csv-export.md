# FC-25 — CSV export

**Phase:** 4 — Export Tools · **Depends on:** FC-14, FC-15 · **Platforms:** web, desktop

## Goal
Let users download a plain-text spreadsheet backup of their whole collection, generated **on the client** with
PapaParse (SRS §3.3).

## Subtasks
- [ ] `packages/export/src/csv.ts`: `buildCollectionCsv(items, options)` using PapaParse `unparse`
- [ ] Columns: category, title, subtitle, year, format, ownership, quantity, acquired date, purchase price, estimated value, currency, tags, notes, provider, external ID, provider URL, date added
- [ ] Copy-detail columns (FC-15): resolution, HDR, edition, disc count, region, platform, storefront, condition, … — one column per known field; empty when not relevant to the category
- [ ] Titles/years use the user's overrides; optional "include original API values" columns
- [ ] Options: scope (all / current filter / selected items), categories, sort by category / acquisition date / estimated value (SRS requirement)
- [ ] UTF-8 with BOM so Excel opens special characters correctly; ISO dates
- [ ] Download via Blob + `a[download]` (file name `fanste-collection-YYYY-MM-DD.csv`); in Electron, use a native "Save as" dialog through the preload bridge
- [ ] Export page / dialog with the options above
- [ ] Unit tests (escaping commas, quotes, newlines, empty values)

## Acceptance criteria
- Exported CSV opens correctly in Excel, Google Sheets and Numbers.
- Export of 5,000 items finishes in under 3 seconds on desktop.
- No server endpoint is involved in generating the file.
