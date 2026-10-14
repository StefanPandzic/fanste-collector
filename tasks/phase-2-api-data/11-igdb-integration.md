# FC-11 — IGDB integration (Video Games)

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-08 · **Category:** `video_game`

## Goal
Adapter for IGDB (Twitch) to catalog video games with per-platform granularity.

## Subtasks
- [x] Create a Twitch developer app; store `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
- [x] Client-credentials token flow; cache the app access token until expiry and refresh automatically
- [x] `search`: POST `/v4/games` with Apicalypse query (`search "<q>"; fields name, first_release_date, cover.image_id, platforms.name; limit 20;`)
- [x] `getById`: fetch game with cover, platforms, genres, involved companies, summary
- [x] Map to `NormalizedItem`: title, year (from `first_release_date`), cover (`t_cover_big`), thumbnail (`t_thumb`), developers → `creators`, platforms in `extra`
      (done with cover `t_cover_big_2x` and thumbnail `t_cover_big`: the square 90×90 `t_thumb` is cropped and
      blurry on portrait cards)
      (done with cover `t_cover_big_2x` and thumbnail `t_cover_big`: the square 90×90 `t_thumb` is cropped and
      blurry on portrait cards)
- [x] Platform list endpoint (cached) to drive the "format/platform" dropdown when adding a game
- [x] Rate limit: 4 req/s, max 8 concurrent
- [x] Unit tests with fixtures
- [ ] *(Stretch)* RAWG adapter as a fallback provider behind the same interface

- [x] Copy details for video games (moved here from FC-15, which shipped Movies & TV only):
  - [x] `VideoGameDetails` schema in `packages/core/src/models/copy-details.ts` (replaces the loose record):
        `platform` (from the IGDB platform list), `storefront` (Steam, Epic Games Store, GOG, PlayStation Store,
        Xbox Store, Nintendo eShop, Battle.net, EA app, Ubisoft Connect, itch.io), `discCount`, `edition`
        (Standard, Deluxe, GOTY, Collector's), `region` (PAL, NTSC-U, NTSC-J, Region-free), `completeness`
        (Sealed, CIB, Loose), `dlcNotes`; add its patch schema and `parseDetails` branch
  - [x] Media (Disc, Cartridge, Digital, Digital code) in `FORMATS_BY_CATEGORY` and the option lists in
        `copy-options.ts`
  - [x] `prefillDetails` for IGDB: a game with exactly one platform preselects `platform`; otherwise the game's
        platforms are offered in `choices`
  - [x] `REMEMBERED_DETAIL_FIELDS.video_game`
- [x] Search & add UI for video games (moved here from FC-17, which shipped Movies & TV only):
  - [x] Enable Video Games in the search category selector (`SEARCHABLE_CATEGORIES` in
        `apps/web/src/features/search/search-state.ts`)
  - [x] Platform filter on the search page (added during FC-11): one-click popular platforms (PC, PS5,
        PS4, Xbox Series X|S, Xbox One, Switch 2, Switch) and "More platforms" with the full IGDB list;
        `platform=` (an IGDB platform ID) on `GET /api/search`
  - [x] Game copy-details fields in the "Add with details" dialog (platform, medium, storefront, discs, …),
        prefilled and marked "from IGDB"
- [x] Gallery filters and badges for video games (moved here from FC-18, which shipped Movies & TV only):
  - [x] Filters on platform and storefront (e.g. all Steam games): add the keys to
        `collectionDetailsFilterSchema` (`@fanste/core`), to `collection_item_filter_flags` /
        `collection_facets` (a migration) and to `COLLECTION_FACETS`, then to the gallery's `FilterPanel`
        and URL state (`gallery-state.ts`)
  - [x] Game badges in `copyBadges` (e.g. "Steam", "PS5")
- [x] Item page for video games (moved here from FC-19, which shipped Movies & TV only):
  - [x] Video-game section in `mediaFacts` (`apps/web/src/features/item-detail/item-detail-view.ts`):
        platforms, developer
  - [x] Game copy-details fields on the item page (platform, storefront, discs, edition, completeness),
        saved per field; acceptance: marking a game "Digital, Steam" shows at once in the gallery

## Acceptance criteria
- A user can find and add a game from search in the browser and the desktop app (from FC-17).
- Searching "Elden Ring" returns the game with cover art and its platforms.
- A user can record a game as "Digital, Steam, PC" (from FC-15).
- The token is refreshed automatically after expiry without failing a user request.

## Notes
- Attribution to IGDB/Twitch in the About screen (FC-27).
