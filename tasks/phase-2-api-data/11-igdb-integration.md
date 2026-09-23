# FC-11 — IGDB integration (Video Games)

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-08 · **Category:** `video_game`

## Goal
Adapter for IGDB (Twitch) to catalog video games with per-platform granularity.

## Subtasks
- [ ] Create a Twitch developer app; store `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
- [ ] Client-credentials token flow; cache the app access token until expiry and refresh automatically
- [ ] `search`: POST `/v4/games` with Apicalypse query (`search "<q>"; fields name, first_release_date, cover.image_id, platforms.name; limit 20;`)
- [ ] `getById`: fetch game with cover, platforms, genres, involved companies, summary
- [ ] Map to `NormalizedItem`: title, year (from `first_release_date`), cover (`t_cover_big`), thumbnail (`t_thumb`), developers → `creators`, platforms in `extra`
- [ ] Platform list endpoint (cached) to drive the "format/platform" dropdown when adding a game
- [ ] Rate limit: 4 req/s, max 8 concurrent
- [ ] Unit tests with fixtures
- [ ] *(Stretch)* RAWG adapter as a fallback provider behind the same interface

## Acceptance criteria
- Searching "Elden Ring" returns the game with cover art and its platforms.
- The token is refreshed automatically after expiry without failing a user request.

## Notes
- Attribution to IGDB/Twitch in the About screen (FC-27).
