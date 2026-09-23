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

## Acceptance criteria
- Searching "Abbey Road" with the Vinyl filter returns vinyl releases with cover art.
- Loading a gallery of 50 music items does not call Discogs when metadata is cached.
- Hitting the rate limit results in queued/retried requests, not errors shown to the user.

## Notes
- Discogs images require authenticated requests for full size; store the URL returned by the API in the cache.
- Attribution: "Data provided by Discogs" (FC-27).
