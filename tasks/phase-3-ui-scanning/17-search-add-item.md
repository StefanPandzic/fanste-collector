# FC-17 — Unified search & add item

**Phase:** 3 — Core Interfaces · **Depends on:** FC-09–FC-16 · **Platforms:** web, desktop

## Goal
One search experience across all categories: pick a category, type a query, see normalized results with cover art,
and add an item to the collection in one or two clicks — no manual data entry (SRS §1).

## Subtasks
- [ ] Search page / screen with a category selector (segmented control / tabs) and a debounced input (300 ms)
- [ ] Results list using `SearchResult` + `ItemCard`; infinite scroll / "load more"
- [ ] "Already in collection" indicator on results (match by provider + externalId)
- [ ] Quick add (defaults: ownership `owned`, format and details from `prefillDetails` / the user's last-used values — FC-15)
- [ ] "Add with details" sheet/dialog:
  - [ ] Common fields: ownership status, quantity, acquisition date, purchase price, estimated value, tags, notes
  - [ ] Category-specific copy details from FC-15, **prefilled from the API** and editable before saving — e.g. movie: medium, resolution, HDR, edition, discs; game: platform, medium, storefront (Steam, …), discs; music: medium, discs, vinyl size/speed/variant, catalog number
  - [ ] Prefilled fields are visually marked ("from Discogs") until the user changes them
- [ ] Music filters (Vinyl / CD / Cassette); TV vs Movie toggle; year filter where the provider supports it
- [ ] "Can't find it? Add manually" → custom item form (FC-13)
- [ ] Recent searches (local storage)
- [ ] Loading, empty and provider-error states (e.g. "Discogs is busy, retrying…")
- [ ] Global search shortcut on desktop (`Ctrl/Cmd + K`)

## Acceptance criteria
- A user can find and add an item from each provider-backed category in the browser and the desktop app.
- An added item appears in the collection immediately (optimistic) and on other devices via realtime.
