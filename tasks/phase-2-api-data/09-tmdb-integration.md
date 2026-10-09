# FC-09 — TMDB integration (Movies & TV)

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-08 · **Categories:** `movie`, `tv`

## Goal
Adapter for The Movie Database (TMDB) API v3 that returns normalized movie and TV data with poster art.

## Subtasks
- [x] Register TMDB developer account; store `TMDB_API_READ_TOKEN` (v4 bearer token) server-side
- [x] Fetch `/configuration` once and cache image base URL + sizes
- [x] `search`:
  - [x] Movies: `/search/movie` (supports `year`)
  - [x] TV: `/search/tv` (supports `first_air_date_year`)
- [x] `getById`: `/movie/{id}` and `/tv/{id}` with `append_to_response=credits,external_ids` (keep only what we need)
- [x] Map to `NormalizedItem`: title, release year, poster (`w500`), thumbnail (`w185`), overview, genres, director(s)/creators, runtime / seasons in `extra`, `imdb_id` in `extra`
- [x] Language: default `en-US`, make configurable
- [x] Rate-limit config (TMDB allows roughly ~50 req/s; use a conservative limit like 20 req/s)
- [x] Expose a `matchMovie(title, year)` helper used by the scanner (FC-23)
- [x] Unit tests with recorded fixtures (no live calls in CI)

## Acceptance criteria
- Searching "Inception" in Movies returns the 2010 film with its poster as the first result.
- Detail endpoint returns a valid `NormalizedItem` for both a movie and a TV show.

## Notes
- TV details use `append_to_response=external_ids` only: creators come from the show's `created_by`, so TV
  credits aren't fetched.
- The gateway search takes an optional `year` (`/api/search?...&year=`), used by TMDB and ignored by other
  providers until their task. `TMDB_LANGUAGE` sets one language per deployment (`metadata_cache` isn't keyed
  by language).
- `tmdbMatcher` (`apps/web/src/server/gateway.ts`) returns raw candidates with popularity; FC-23 scores them
  and implements `POST /api/match/tmdb`.
- TMDB requires attribution (logo + notice) — see FC-27.
- External IDs are encoded as `movie:{id}` / `tv:{id}` (FC-05 check constraint), because TMDB movie and TV IDs overlap.
