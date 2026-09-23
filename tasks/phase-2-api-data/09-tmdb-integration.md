# FC-09 — TMDB integration (Movies & TV)

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-08 · **Categories:** `movie`, `tv`

## Goal
Adapter for The Movie Database (TMDB) API v3 that returns normalized movie and TV data with poster art.

## Subtasks
- [ ] Register TMDB developer account; store `TMDB_API_READ_TOKEN` (v4 bearer token) server-side
- [ ] Fetch `/configuration` once and cache image base URL + sizes
- [ ] `search`:
  - [ ] Movies: `/search/movie` (supports `year`)
  - [ ] TV: `/search/tv` (supports `first_air_date_year`)
- [ ] `getById`: `/movie/{id}` and `/tv/{id}` with `append_to_response=credits,external_ids` (keep only what we need)
- [ ] Map to `NormalizedItem`: title, release year, poster (`w500`), thumbnail (`w185`), overview, genres, director(s)/creators, runtime / seasons in `extra`, `imdb_id` in `extra`
- [ ] Language: default `en-US`, make configurable
- [ ] Rate-limit config (TMDB allows roughly ~50 req/s; use a conservative limit like 20 req/s)
- [ ] Expose a `matchMovie(title, year)` helper used by the scanner (FC-23)
- [ ] Unit tests with recorded fixtures (no live calls in CI)

## Acceptance criteria
- Searching "Inception" in Movies returns the 2010 film with its poster as the first result.
- Detail endpoint returns a valid `NormalizedItem` for both a movie and a TV show.

## Notes
- TMDB requires attribution (logo + notice) — see FC-27.
