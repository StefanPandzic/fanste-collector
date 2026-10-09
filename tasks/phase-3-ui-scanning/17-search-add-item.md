# FC-17 — Unified search & add item

**Phase:** 3 — Core Interfaces · **Depends on:** FC-09–FC-16 · **Platforms:** web, desktop

## Goal
One search experience across all categories: pick a category, type a query, see normalized results with cover art,
and add an item to the collection in one or two clicks — no manual data entry (SRS §1).

Movies & TV ship first (TMDB). The other categories show in the selector as "Coming soon"; their search and add
parts moved to their provider tasks (FC-10 music, FC-11 video games, FC-12 board games, FC-13 Funko / manual items).

## Subtasks
- [x] Search page / screen with a category selector (segmented control / tabs) and a debounced input (300 ms)
- [x] Results list using `SearchResult` + `ItemCard`; infinite scroll / "load more"
- [x] "Already in collection" indicator on results (match by provider + externalId)
- [x] Quick add (defaults: ownership `owned`, format and details from `prefillDetails` / the user's last-used values — FC-15). A TV quick add owns every season except Specials
- [x] "Add with details" sheet/dialog:
  - [x] Common fields: ownership status, quantity, acquisition date, purchase price, estimated value, notes (tags come with FC-19)
  - [x] Category-specific copy details from FC-15, **prefilled from the API** and editable before saving — movie: medium, resolution, HDR, audio channels, file format, audio and subtitle languages, edition, discs; TV: the same plus the seasons owned (pick seasons, then all or some episodes)
    - [ ] *(Moved to FC-11)* game: platform, medium, storefront (Steam, …), discs
    - [ ] *(Moved to FC-10)* music: medium, discs, vinyl size/speed/variant, catalog number
  - [x] Prefilled fields are visually marked ("from TMDB", "last used") until the user changes them
- [x] TV vs Movie toggle (the Movies and TV Shows tabs); year filter where the provider supports it (TMDB)
  - [ ] *(Moved to FC-10)* Music filters (Vinyl / CD / Cassette)
- [ ] *(Moved to FC-13)* "Can't find it? Add manually" → custom item form
- [x] Recent searches (local storage)
- [x] Loading, empty and provider-error states (e.g. "TMDB is busy, retrying…")
- [x] Global search shortcut on desktop (`Ctrl/Cmd + K`)

## Acceptance criteria
- A user can find and add an item from each provider-backed category in the browser and the desktop app.
  Movies & TV here; music, games and board games moved to FC-10, FC-11 and FC-12.
- An added item appears in the collection immediately (optimistic) and on other devices via realtime.
