# FC-20 — Dashboard

**Phase:** 3 — Core Interfaces · **Depends on:** FC-14, FC-16 · **Platforms:** web, desktop

## Goal
Landing screen after sign-in that gives an overview of the whole collection across categories.

## Subtasks
- [ ] Stat tiles: total items, items per category, wishlist count, total estimated value (in the default currency)
- [ ] Category cards linking to the filtered gallery
- [ ] "Recently added" row (last 12 items with covers)
- [ ] Simple chart: items added per month (last 12 months) and/or value by category
- [ ] Onboarding empty state for new users: "Search to add your first item" + (desktop) "Scan a media folder"
- [ ] Stats come from one aggregate query / RPC (`get_collection_stats`) rather than client-side counting

## Acceptance criteria
- Dashboard renders in under 1 second for a 5,000-item collection.
- Numbers update live when items are added or removed on another device.
