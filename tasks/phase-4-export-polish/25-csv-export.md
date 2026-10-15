# FC-25 — CSV export

**Phase:** 4 — Export Tools · **Depends on:** FC-14, FC-15 · **Platforms:** web, desktop

## Goal
Let users download a plain-text spreadsheet backup of their whole collection, generated **on the client** with
PapaParse (SRS §3.3).

## Subtasks
- [x] `packages/export/src/csv.ts`: `buildCollectionCsv(items, options)` using PapaParse `unparse`
- [x] Columns: category, title, subtitle, year, format, ownership, quantity, acquired date, purchase price, estimated value, currency, tags, notes, provider, external ID, provider URL, date added
- [x] Copy-detail columns (FC-15): resolution, HDR, audio channels, file format, audio/subtitle languages, TV seasons/episodes owned, edition, disc count, region, platform, storefront, condition, … — one column per known field; empty when not relevant to the category
- [x] Titles/years use the user's overrides; optional "include original API values" columns
- [x] Options: scope (all / current filter / selected items), categories, sort by category / acquisition date / estimated value (SRS requirement)
- [x] UTF-8 with BOM so Excel opens special characters correctly; ISO dates
- [x] Download via Blob + `a[download]` (file name `fanste-collection-YYYY-MM-DD.csv`); in Electron, use a native "Save as" dialog through the preload bridge
- [x] Export page / dialog with the options above
- [x] Unit tests (escaping commas, quotes, newlines, empty values)

## Acceptance criteria
- Exported CSV opens correctly in Excel, Google Sheets and Numbers.
- Export of 5,000 items finishes in under 3 seconds on desktop.
- No server endpoint is involved in generating the file.

## Notes
- Categories (FC-25 decision): the user picks the categories and custom collections to export, and either one
  combined CSV or a ZIP with one CSV per category / custom collection, each with only its own columns.
- Scopes: `/export` exports the whole collection; the gallery's Export button exports its current filters and
  the selection bar's Export the selected items, all through the same dialog.
- Desktop saves through `window.fanste.files.saveFile` (native Save dialog); the browser downloads a Blob.
- The 5,000-item time covers building the file; loading the items is network time and isn't part of it.
