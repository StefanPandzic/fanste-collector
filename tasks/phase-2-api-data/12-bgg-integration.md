# FC-12 — BoardGameGeek integration + XML parser

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-08 · **Category:** `board_game`

## Goal
Adapter for the BoardGameGeek XML API2. BGG returns **XML**, so the gateway converts it to JSON and normalizes it
(SRS §4, "Needs Parser").

## Subtasks
- [ ] Check current BGG XML API terms of use (registration / token may be required) and configure `BGG_API_TOKEN` if needed
- [ ] XML → JSON parser utility using `fast-xml-parser` (server-side, in the gateway)
  - [ ] Handle attributes (`value="..."`), single-vs-array element quirks, HTML entities in descriptions
- [ ] `search`: `/xmlapi2/search?query=&type=boardgame` (returns IDs + names only)
- [ ] Enrich search results: `/xmlapi2/thing?id=1,2,3...` in **one batched call** (up to 20 IDs per request) for thumbnails/years
- [ ] `getById`: `/xmlapi2/thing?id=&stats=1`
- [ ] Map to `NormalizedItem`: primary name, year published, image/thumbnail, description, designers → `creators`, `extra` = min/max players, playing time, min age, weight, BGG rank
- [ ] Handle BGG `202 Accepted` "request queued" responses with retry/backoff
- [ ] Rate limit: conservative (~1 req / 2 s)
- [ ] Unit tests with XML fixtures

## Acceptance criteria
- Searching "Catan" returns results with year and thumbnail.
- Parser unit tests cover single-item, multi-item and missing-field XML cases.

## Notes
- Attribution "Powered by BoardGameGeek" with a link back (FC-27).
