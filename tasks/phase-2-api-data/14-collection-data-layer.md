# FC-14 — Collection data layer & realtime sync

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-06, FC-07 · **Platforms:** web, desktop

## Goal
A shared data-access layer (TanStack Query hooks over Supabase) for collection CRUD, with **instant cross-device sync**
through Supabase Realtime: an item added in the browser shows up in the desktop app right away, and vice versa (SRS §3.1).

## Subtasks
- [ ] Repository functions in a shared package (`packages/supabase` or `packages/collection`):
  - [ ] `listItems({ category, ownership, tags, search, sort, page })` (reads `collection_items_view`)
  - [ ] `getItem(id)`, `addItem(input)`, `updateItem(id, patch)`, `deleteItem(id)`, `bulkDelete(ids)`
  - [ ] Tag CRUD + assign/unassign
  - [ ] `getStats()` — counts per category / ownership, total estimated value (for FC-20)
- [ ] `addItem` from search: call the gateway so `metadata_cache` is filled, then insert the `collection_items` row with prefilled `format` / `details` (FC-15)
- [ ] Editing copy details and metadata overrides (`updateItemDetails`, `updateOverrides`, `resetOverride`) is specified in FC-15
- [ ] Query hooks: `useCollection`, `useCollectionItem`, `useAddItem`, `useUpdateItem`, `useDeleteItem`, `useTags`, `useCollectionStats`
- [ ] Optimistic updates with rollback on error
- [ ] Realtime: subscribe to `collection_items` changes for the current user and invalidate/patch the query cache
- [ ] Refetch on window focus / network reconnect; resubscribe to Realtime after the connection drops
- [ ] Missing metadata fallback: if a row has no cache entry, fetch it via `/api/items/batch`
- [ ] Integration tests for repository functions against the dev Supabase Cloud project (test user, cleaned up after each run)

## Acceptance criteria
- Adding, editing and deleting items works in the browser and the desktop app through the same hooks.
- With the browser and the desktop app open side by side, an item added in one appears in the other within ~2 seconds without a manual refresh.
- Optimistic UI rolls back and shows a toast on failure.
