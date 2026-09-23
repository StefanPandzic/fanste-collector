# FC-26 — PDF catalog export

**Phase:** 4 — Export Tools · **Depends on:** FC-14, FC-15 · **Platforms:** web, desktop

## Goal
Generate print-ready PDF catalogs on the client for sharing, insurance and archiving: cover art grids, titles and
ownership metadata (SRS §3.3).

## Subtasks
- [ ] `packages/export/src/pdf.ts` using **jsPDF**
- [ ] Layouts:
  - [ ] **Grid catalog** — cover thumbnails (custom cover if overridden) with title/year/format and key copy details under each (e.g. "4K UHD · Steelbook", "PS5 · Disc"), e.g. 4×5 per A4 page
  - [ ] **Insurance list** — table: title, format, key copy details (edition, discs, platform/storefront, condition), quantity, acquired date, purchase price, estimated value; category subtotals and grand total
- [ ] Cover page: "Fanste Collector" branding, user name, export date, item count, total estimated value
- [ ] Header/footer with page numbers; group by category with section headings
- [ ] Image loading: fetch covers, downscale via canvas to keep file size reasonable, placeholder when an image fails (CORS)
  - [ ] If a provider blocks CORS, proxy thumbnails through a gateway route `/api/image?url=` (allow-listed hosts only)
- [ ] Options: layout, paper size (A4 / Letter), scope (all / filter / selection), include prices yes/no
- [ ] Progress indicator for large exports; run in a Web Worker if the main thread gets blocked
- [ ] Provider attribution in the footer where required (FC-27)

## Acceptance criteria
- A 500-item grid catalog generates in under 30 s on desktop and stays under ~25 MB.
- The insurance list totals match the dashboard total estimated value.
- The PDF prints correctly on A4 and Letter.
