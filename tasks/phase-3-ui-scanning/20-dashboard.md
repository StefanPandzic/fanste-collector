# FC-20 — Dashboard

**Phase:** 3 — Core Interfaces · **Depends on:** FC-14, FC-16 · **Platforms:** web, desktop

## Goal
Landing screen after sign-in that gives an overview of the whole collection across categories.

## Subtasks
- [x] Stat tiles: total items, items per category, wishlist count, total estimated value (in the default currency)
- [x] Category cards linking to the filtered gallery
- [x] "Recently added" row (last 12 items with covers)
- [x] Simple chart: items added per month (last 12 months) and/or value by category
- [x] Onboarding empty state for new users: "Search to add your first item" + (desktop) "Scan a media folder"
- [x] Stats come from one aggregate query / RPC (`get_collection_stats`) rather than client-side counting

## Acceptance criteria
- Dashboard renders in under 1 second for a 5,000-item collection.
- Numbers update live when items are added or removed on another device.

## Notes
- The RPC is `collection_stats(p_time_zone)` (FC-14's function, extended), not `get_collection_stats`.
- Counts are the copies the user has (owned, preordered, loaned out); wishlist has its own tile.
- The value is shown in the default currency; other currencies are listed apart, not converted.
- Category cards for Music, Video Games, Board Games and Funko show "Coming soon" until FC-10–FC-13.
