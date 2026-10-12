# FC-10 — Discogs integration (Physical Music)

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-08 · **Category:** `music`

## Goal
Adapter for the Discogs API to catalog vinyl, CD and cassette releases with pressing details.

This task uses only the app's own credentials (database search and release metadata). Letting a user connect
their own Discogs account and sync their Discogs collection is FC-31.

## Subtasks
- [ ] Register a Discogs application (ideally on a dedicated Fanste Collector account, not a personal profile) and
      authenticate with its Consumer Key + Secret (`DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`), not a
      personal access token; replace `DISCOGS_TOKEN` in `.env.example` and the web env schema. FC-31 reuses the
      same credentials for the user OAuth flow
- [x] Always send a descriptive `User-Agent` (`FansteCollector/1.0 +<url>`) — Discogs requires it
- [x] `search`: `/database/search?q=&type=release` (optionally `master`), support `format` filter (Vinyl / CD / Cassette)
- [x] `getById`: `/releases/{id}` and `/masters/{id}`; external ID encoded as `release:{id}` / `master:{id}`
- [x] Map to `NormalizedItem`: title, artist(s) → `subtitle`, year, cover image, genres + styles, `extra` = label, catalog number, country, formats, tracklist
- [x] Strict rate limiting: authenticated limit is ~60 req/min — configure the throttle and read `X-Discogs-Ratelimit-Remaining` headers
- [x] Always go cache-first (FC-08); never fetch details for gallery views
- [x] Unit tests with fixtures
- [x] Copy details for music (moved here from FC-15, which shipped Movies & TV only):
  - [x] `MusicDetails` schema in `packages/core/src/models/copy-details.ts` (replaces the loose record):
        `discCount`, `vinylSize` (7", 10", 12"), `speed` (33⅓, 45, 78), `variant` (color / picture disc),
        `catalogNumber`, `mediaCondition` + `sleeveCondition` (Goldmine M, NM, VG+, VG, G, P); add its patch
        schema and `parseDetails` branch
  - [x] Media (Vinyl, CD, Cassette, Digital) in `FORMATS_BY_CATEGORY` and the option lists in `copy-options.ts`
  - [x] `prefillDetails` for Discogs releases: `formats` → `format`, `qty` → `discCount`, descriptions →
        `vinylSize`, `speed`, `variant`; label catalog number → `catalogNumber` (tests with fixtures)
  - [x] `REMEMBERED_DETAIL_FIELDS.music`
- [x] Search & add UI for music (moved here from FC-17, which shipped Movies & TV only):
  - [x] Enable Music in the search category selector (`SEARCHABLE_CATEGORIES` in
        `apps/web/src/features/search/search-state.ts`)
  - [x] Music filters (Vinyl / CD / Cassette) on the search page
  - [x] Music copy-details fields in the "Add with details" dialog (medium, discs, vinyl size/speed/variant,
        catalog number), prefilled and marked "from Discogs"
- [x] Gallery filters and badges for music (moved here from FC-18, which shipped Movies & TV only):
  - [x] Filters on vinyl size and media/sleeve condition: add the keys to `collectionDetailsFilterSchema`
        (`@fanste/core`), to `collection_item_filter_flags` / `collection_facets` (a migration) and to
        `COLLECTION_FACETS`, then to the gallery's `FilterPanel` and URL state (`gallery-state.ts`)
  - [x] Music badges in `copyBadges` (e.g. "2×LP", "12″", "NM")
- [x] Item page for music (moved here from FC-19, which shipped Movies & TV only):
  - [x] Music section in `mediaFacts` (`apps/web/src/features/item-detail/item-detail-view.ts`): label,
        catalog number, country, tracklist
  - [x] Music copy-details fields on the item page (discs, vinyl size/speed/variant, condition), saved
        per field like the movie fields

- [x] Finding one pressing among hundreds (added during FC-10):
  - [x] Music search filters: release country (`country=`) and a barcode / catalog number lookup
        (`barcode=` / `catno=`) that works without a title
  - [x] Barcodes and matrix / runout codes from the release's `identifiers` in `MusicExtra`
  - [x] The add dialog shows the pressing before adding: label, catalog number, country, format,
        barcode, matrix / runout, notes and tracklist (`ReleaseDetails`, shared with the item page)
  - [x] Release country in the gallery list view and as a gallery filter with counts (flag 16 of
        `collection_item_filter_flags`, read from the cached Discogs data)
  - [x] Discogs price guide moved to FC-31 (it needs the user's own Discogs login)

## Acceptance criteria
- A user can find and add a music release from search in the browser and the desktop app (from FC-17).
- Searching "Abbey Road" with the Vinyl filter returns vinyl releases with cover art.
- Adding a vinyl release from Discogs prefills medium, number of discs and catalog number; the user can change any
  of them before saving (from FC-15).
- Loading a gallery of 50 music items does not call Discogs when metadata is cached.
- Hitting the rate limit results in queued/retried requests, not errors shown to the user.
- Searching by a release's barcode or catalog number finds that pressing; "Michael Jackson Bad" with
  Vinyl and a country narrows the results to that country's pressings.

## Notes
- Discogs images require authenticated requests for full size; store the URL returned by the API in the cache.
- Attribution: "Data provided by Discogs" (FC-27).
- Key + secret auth gives the authenticated rate limit and database search, but no access to any user's
  collection or wantlist; that needs per-user OAuth tokens (FC-31).
