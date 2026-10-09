# FC-10 — Discogs integration (Physical Music)

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-08 · **Category:** `music`

## Goal
Adapter for the Discogs API to catalog vinyl, CD and cassette releases with pressing details.

## Subtasks
- [ ] Register a Discogs app; use a personal access token (`DISCOGS_TOKEN`) for authenticated requests
- [ ] Always send a descriptive `User-Agent` (`FansteCollector/1.0 +<url>`) — Discogs requires it
- [ ] `search`: `/database/search?q=&type=release` (optionally `master`), support `format` filter (Vinyl / CD / Cassette)
- [ ] `getById`: `/releases/{id}` and `/masters/{id}`; external ID encoded as `release:{id}` / `master:{id}`
- [ ] Map to `NormalizedItem`: title, artist(s) → `subtitle`, year, cover image, genres + styles, `extra` = label, catalog number, country, formats, tracklist
- [ ] Strict rate limiting: authenticated limit is ~60 req/min — configure the throttle and read `X-Discogs-Ratelimit-Remaining` headers
- [ ] Always go cache-first (FC-08); never fetch details for gallery views
- [ ] Unit tests with fixtures
- [ ] Copy details for music (moved here from FC-15, which shipped Movies & TV only):
  - [ ] `MusicDetails` schema in `packages/core/src/models/copy-details.ts` (replaces the loose record):
        `discCount`, `vinylSize` (7", 10", 12"), `speed` (33⅓, 45, 78), `variant` (color / picture disc),
        `catalogNumber`, `mediaCondition` + `sleeveCondition` (Goldmine M, NM, VG+, VG, G, P); add its patch
        schema and `parseDetails` branch
  - [ ] Media (Vinyl, CD, Cassette, Digital) in `FORMATS_BY_CATEGORY` and the option lists in `copy-options.ts`
  - [ ] `prefillDetails` for Discogs releases: `formats` → `format`, `qty` → `discCount`, descriptions →
        `vinylSize`, `speed`, `variant`; label catalog number → `catalogNumber` (tests with fixtures)
  - [ ] `REMEMBERED_DETAIL_FIELDS.music`

## Acceptance criteria
- Searching "Abbey Road" with the Vinyl filter returns vinyl releases with cover art.
- Adding a vinyl release from Discogs prefills medium, number of discs and catalog number; the user can change any
  of them before saving (from FC-15).
- Loading a gallery of 50 music items does not call Discogs when metadata is cached.
- Hitting the rate limit results in queued/retried requests, not errors shown to the user.

## Notes
- Discogs images require authenticated requests for full size; store the URL returned by the API in the cache.
- Attribution: "Data provided by Discogs" (FC-27).
