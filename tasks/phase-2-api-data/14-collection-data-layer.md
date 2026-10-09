# FC-14 — Collection data layer & realtime sync

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-06, FC-07 · **Platforms:** web, desktop

## Goal
A shared data-access layer (TanStack Query hooks over Supabase) for collection CRUD, with **instant cross-device sync**
through Supabase Realtime: an item added in the browser shows up in the desktop app right away, and vice versa (SRS §3.1).

## Subtasks
- [x] Repository functions in a shared package (`packages/supabase` or `packages/collection`):
  - [x] `listItems({ category, ownership, tags, search, sort, page })` (reads `collection_items_view`)
  - [x] `getItem(id)`, `addItem(input)`, `updateItem(id, patch)`, `deleteItem(id)`, `bulkDelete(ids)`
  - [x] Tag CRUD + assign/unassign
  - [x] `getStats()` — counts per category / ownership, total estimated value (for FC-20)
- [x] `addItem` from search: call the gateway so `metadata_cache` is filled, then insert the `collection_items` row with prefilled `format` / `details` (FC-15)
- [ ] Editing copy details and metadata overrides (`updateItemDetails`, `updateOverrides`, `resetOverride`) is specified in FC-15
- [x] Query hooks: `useCollection`, `useCollectionItem`, `useAddItem`, `useUpdateItem`, `useDeleteItem`, `useTags`, `useCollectionStats`
- [x] Optimistic updates with rollback on error
- [x] Realtime: subscribe to the current user's private Broadcast topic (`supabase.channel('user:<id>', { config: { private: true } })`, after `supabase.realtime.setAuth()`); FC-05 triggers send `INSERT` / `UPDATE` / `DELETE` events for `collection_items` and `collection_item_tags` there. Invalidate/patch the query cache from them
- [x] Refetch on window focus / network reconnect; resubscribe to Realtime after the connection drops
- [x] Missing metadata fallback: if a row has no cache entry, fetch it via `/api/items/batch`
- [x] Integration tests for repository functions against the dev Supabase Cloud project (test user, cleaned up after each run)

## Acceptance criteria
- Adding, editing and deleting items works in the browser and the desktop app through the same hooks.
- With the browser and the desktop app open side by side, an item added in one appears in the other within ~2 seconds without a manual refresh.
- Optimistic UI rolls back and shows a toast on failure.

## Notes
- The `missing` reasons from the FC-08 note are done: `missing` entries carry `reason: not_found | retry_later`, and `useMissingMetadata` never re-requests `not_found` refs (per session).
- Tags have no Realtime trigger, so a tag created or renamed on another device appears after the next refetch (focus, reconnect, or a tag-link event).
- `collection_items.format_key` is a generated column (FC-05): the generated Insert/Update types allow it, but Postgres rejects writes to it. Omit it from the repository's write types, and never send a whole `select('*')` row back.
- The Realtime triggers send one message per row: a bulk delete (plus its cascaded tag links) or a scanner import (FC-23) produces hundreds of events. Debounce the query invalidation instead of refetching per event.
- From the FC-08 review: `missing` in the batch response mixes refs over the per-request fetch budget (ask again
  later) with refs the provider no longer has (`not_found`), and `not_found` isn't cached. Before the UI re-requests
  `missing` automatically, add a reason per entry or negative caching, so deleted items don't cost provider quota on
  every load.
