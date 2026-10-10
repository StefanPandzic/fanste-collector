# FC-18 — Collection gallery & filters

**Phase:** 3 — Core Interfaces · **Depends on:** FC-14, FC-15, FC-16 · **Platforms:** web, desktop

## Goal
A visual gallery of the user's collection with fast filtering, sorting and in-collection search.

Movies & TV ship first. The category-specific filters and badges for games and music moved to FC-11 and
FC-10, which type those copy details.

## Subtasks
- [x] Gallery with grid (cover art) and list (compact table) views, remembered per user/device
- [x] Filters: category, ownership status, format (medium), tags, source (manual/search/scanner), acquisition date range
- [x] Category-specific filters on copy details (FC-15): movie resolution / HDR / edition (plus audio and subtitle language)
  - [ ] *(Moved to FC-11)* game platform / storefront (e.g. all Steam games)
  - [ ] *(Moved to FC-10)* music vinyl size / condition
- [x] Card and list view show the key copy details as small badges (e.g. "4K UHD · Dolby Vision")
  - [ ] *(Moved to FC-11 / FC-10)* game and music badges ("Steam", "2×LP")
- [x] Sort: title, date added, acquisition date, release year, estimated value
- [x] Text search within the collection (title/subtitle)
- [x] Filter state stored in the URL query (web) so views can be bookmarked
- [x] Metadata loaded in one batch (cache-first) — never one request per card (SRS §4.1)
- [x] Multi-select + bulk actions: delete, change ownership, add tag
- [x] Counts per filter (e.g. "Vinyl (42)")
- [x] Narrow windows: filters collapse into a slide-over drawer

## Acceptance criteria
- Filtering and sorting a 1,000-item collection responds in under 300 ms.
- Opening the gallery sends at most one metadata batch request per page of items.

## Notes
- Filtering, search, sorting and the counts run in Postgres (`collection_items_filtered`,
  `collection_facets`), with one filter implementation, `collection_item_filter_flags`. Measured against
  the dev project with 1,000 items: list and counts together take 96–142 ms end to end (about 75 ms of
  that is the network round trip); in the database the list takes about 7 ms and the counts 40–95 ms.
- The gallery pages are 100 items (`MAX_BATCH_ITEMS`), and each page loads its missing metadata in one
  `/api/items/batch` request (`useMissingMetadataPages`).
- Cards link to `/collection/[id]`, a placeholder until FC-19. Bulk "Add tag" picks from existing tags;
  creating tags comes with FC-19.
