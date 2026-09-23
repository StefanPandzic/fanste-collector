# FC-18 — Collection gallery & filters

**Phase:** 3 — Core Interfaces · **Depends on:** FC-14, FC-15, FC-16 · **Platforms:** web, desktop

## Goal
A visual gallery of the user's collection with fast filtering, sorting and in-collection search.

## Subtasks
- [ ] Gallery with grid (cover art) and list (compact table) views, remembered per user/device
- [ ] Filters: category, ownership status, format (medium), tags, source (manual/search/scanner), acquisition date range
- [ ] Category-specific filters on copy details (FC-15): movie resolution / HDR / edition; game platform / storefront (e.g. all Steam games); music vinyl size / condition
- [ ] Card and list view show the key copy details as small badges (e.g. "4K · Dolby Vision", "Steam", "2×LP")
- [ ] Sort: title, date added, acquisition date, release year, estimated value
- [ ] Text search within the collection (title/subtitle)
- [ ] Filter state stored in the URL query (web) so views can be bookmarked
- [ ] Metadata loaded in one batch (cache-first) — never one request per card (SRS §4.1)
- [ ] Multi-select + bulk actions: delete, change ownership, add tag
- [ ] Counts per filter (e.g. "Vinyl (42)")
- [ ] Narrow windows: filters collapse into a slide-over drawer

## Acceptance criteria
- Filtering and sorting a 1,000-item collection responds in under 300 ms.
- Opening the gallery sends at most one metadata batch request per page of items.
