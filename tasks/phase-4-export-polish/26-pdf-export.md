# FC-26 — PDF catalog export

**Phase:** 4 — Export Tools · **Depends on:** FC-14, FC-15 · **Platforms:** web, desktop

## Goal
Generate print-ready PDF catalogs on the client for sharing, insurance and archiving: cover art grids, titles and
ownership metadata (SRS §3.3).

## Subtasks
- [x] `packages/export/src/pdf.ts` using **jsPDF**
- [x] Layouts:
  - [x] **Grid catalog** — cover thumbnails (custom cover if overridden) with title/year/format and key copy details under each (e.g. "4K UHD · Steelbook", "PS5 · Disc"), e.g. 4×5 per A4 page
  - [x] **Insurance list** — table: title, format, key copy details (edition, discs, platform/storefront, condition), quantity, acquired date, purchase price, estimated value; category subtotals and grand total
- [x] Cover page: "Fanste Collector" branding, user name, export date, item count, total estimated value
- [x] Header/footer with page numbers; group by category with section headings
- [x] Image loading: fetch covers, downscale via canvas to keep file size reasonable, placeholder when an image fails (CORS)
  - [x] If a provider blocks CORS, proxy thumbnails through a gateway route `/api/image?url=` (allow-listed hosts only)
- [x] Options: layout, paper size (A4 / Letter), scope (all / filter / selection), include prices yes/no
- [x] Progress indicator for large exports; run in a Web Worker if the main thread gets blocked
- [x] Provider attribution in the footer where required (FC-27)

## Acceptance criteria
- A 500-item grid catalog generates in under 30 s on desktop and stays under ~25 MB.
- The insurance list totals match the dashboard total estimated value.
- The PDF prints correctly on A4 and Letter.

## Notes
- Fonts (FC-26 decision): Noto Sans (Latin, Greek, Cyrillic) is embedded in every PDF; Noto Sans SC
  (Chinese, Japanese) and Noto Sans KR (Korean) are fetched from `public/fonts` only when the text
  needs them (dates and amounts included). jsPDF embeds only the glyphs used, so the PDF stays
  small. Known limit: Arabic, Hebrew, Thai and Indic scripts aren't in these fonts and print as
  empty boxes.
- Covers: TMDB, IGDB and Supabase Storage send CORS headers and are fetched directly; Discogs and
  BGG go through `/api/image` (allow-listed hosts, its own per-user limit). Other custom-cover hosts
  are tried directly and become a placeholder when they block CORS.
- The insurance list holds only the copies the user has (owned, preordered, lent out), the
  dashboard's rule, so its totals match the dashboard. Totals are per currency, never converted.
  "Include prices" applies to the catalog; the insurance list always has them.
- No Web Worker: drawing yields to the page every 25 items, and a 500-item catalog draws in about
  half a second (the covers' network time is most of the export).
- Attribution: the footer names the metadata providers in the file and the cover page has TMDB's
  notice; the logos come with FC-27.
