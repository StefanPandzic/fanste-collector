# FC-13 — Custom collections

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-05, FC-07, FC-14, FC-15 · **Category:** `custom` (replaces
`funko`) · **Platforms:** web, desktop

## Goal
Besides the integrated categories (TMDB, Discogs, IGDB, BGG), a user can create **their own collections** for
anything they collect: Funko Pops, LEGO sets, comics, coins, sneakers, … A user can have any number of them. There
is no provider behind a custom collection, so every item is entered by hand with a small set of **basic fields**
that fit any kind of object, and it then shows up in the gallery, dashboard and exports like any other item.

## Decisions
- **Funko Pops are no longer a built-in category.** The `funko` category becomes `custom`. A user who collects
  Funko Pops creates a "Funko Pops" collection.
- **Collections are rows, not categories.** A new `custom_collections` table holds the user's collections. Every
  custom item has `category = 'custom'`, `provider = 'custom'` and points at its collection. The
  `item_category` enum keeps one fixed value, so filters, stats and the gallery need no per-collection code.
- **Fixed basic fields for every collection.** Collections don't get their own field definitions in v1 (see
  Notes). The fields are generic enough for any object:
  - **Item** (`custom_data`): `title` (required), `subtitle`, `identifier` (number / code / set number, e.g.
    `#123`, `75192`), `releaseYear`, `creators` (brand / maker / author / artist), `description`, `imageUrl`.
  - **Copy** (`details`, typed like the other categories in FC-15): `condition` (Mint, Near mint, Very good,
    Good, Fair, Poor), `variant` (edition / variant / color, free text), `boxed` (with box / packaging: yes / no).
  - **Already on every copy:** format (`Physical` / `Digital`), ownership, quantity, acquisition date, purchase
    price, estimated value, notes and tags.
- **Deleting a collection deletes its items** (after a confirm dialog that shows how many). Moving items to
  another custom collection is possible from the bulk actions.
- **Manual entry for integrated categories** ("Can't find it? Add manually", moved here from FC-17) uses the same
  form and fields, but keeps the item's real category (e.g. a `movie` with `provider = 'custom'`) and no
  collection.

## Subtasks

### Database
- [x] Migration: rename the enum value (`alter type item_category rename value 'funko' to 'custom'`). No rows use
      it yet, so nothing has to be migrated.
- [x] Table `custom_collections`: `id`, `user_id` (default `auth.uid()`), `name` (1–50 chars, unique per user,
      case-insensitive), `description` (≤ 500), `icon` (one of a fixed list of icon names, checked in Zod and in
      a `check`), `sort_order`, `created_at`, `updated_at`; `unique (id, user_id)` as the target of the
      composite foreign key below. RLS: users read and write only their own rows. Limit: 50 collections per user
      (trigger or RPC check).
- [x] `collection_items.custom_collection_id uuid`, with a composite foreign key
      `(custom_collection_id, user_id) → custom_collections (id, user_id) on delete cascade` (keeps items and
      collections within one user, like the tag links) and an index.
- [x] Checks: `category = 'custom'` ⇔ `custom_collection_id is not null`, and `category = 'custom'` ⇒
      `provider = 'custom'`. Update `collection_items_provider_category` for the new value.
- [x] Broadcast `custom_collections` changes on the `user:<id>` topic (`broadcast_user_change` trigger), so a new
      or renamed collection appears in the other open clients.
- [x] Filtering: add `customCollectionId` to `collection_item_filter_flags` (and `collectionFilterSchema`), and
      count items per collection in `collection_facets`.
- [x] Stats: `collection_stats` counts `custom` like any other category; add the items and copies per
      collection for the dashboard.
- [x] Storage bucket `custom-images` for item photos and cover overrides: per-user folder (`<user id>/<file>`),
      RLS like the avatars bucket, max 1 MB, images only.
- [x] `pnpm db:push` → `pnpm db:types`.

### Core (`packages/core`)
- [x] Category: replace `funko` with `custom` in the enums, `CATEGORY_META` (label "Custom", a neutral accent and
      icon), the design tokens (`category-funko` → `category-custom`), `FORMATS_BY_CATEGORY` (`Physical`,
      `Digital`) and every test / fixture that uses `funko`.
- [x] `customCollectionSchema` + input schemas (create / update): name, description, icon. `CUSTOM_COLLECTION_ICONS`
      list.
- [x] `customItemDataSchema` for `custom_data` (the item fields above, with length limits; `releaseYear` an
      integer; `imageUrl` an `https` URL or a `custom-images` path) and the add-item input for custom items
      (`provider = 'custom'`, no `externalId`, `customCollectionId` required when the category is `custom`).
- [x] `CustomDetails` copy-details schema in `copy-details.ts` (replaces the loose `funko` record), its patch
      schema and the `parseDetails` branch.
- [x] Normalize a custom row to `NormalizedItem` on read (`custom_data` → title, subtitle, year, creators,
      description, image; `identifier` shown with the subtitle), so cards, search badges and exports need no
      special case.

### Data layer (`packages/collection`)
- [x] Repository: `listCustomCollections`, `createCustomCollection`, `updateCustomCollection`,
      `deleteCustomCollection`, `reorderCustomCollections`, `moveItemsToCollection`; `addItem` for custom items
      (no gateway call); `updateItem` for `custom_data`.
- [x] `restoreItem` (undo of a delete) also restores `custom_data` and `custom_collection_id` (it refuses custom
      items until now).
- [x] Hooks: `useCustomCollections`, `useCreateCustomCollection`, … with optimistic updates; realtime events for
      `custom_collections` invalidate them.
- [x] Custom items never call `/api/items/batch` (`missing-metadata` already skips `provider = 'custom'`;
      keep a test).
- [x] Image upload helper: resize / compress to WebP on the client (max ~1200 px, ≤ 1 MB), upload to
      `custom-images`, return the stored URL.

### Web UI (`apps/web`)
- [x] Navigation: a "My collections" section listing the user's collections, with "New collection".
- [x] Create / edit dialog: name, icon, description. Delete with a confirm that names the number of items.
      Drag to reorder (or up / down buttons).
- [x] Collection page: the existing gallery filtered by `customCollectionId`, with an "Add item" button. The
      gallery's category filter shows "Custom" with a sub-filter per collection.
- [x] Add-item form for custom items: the item fields, the copy fields, image by upload or pasted URL, and "Add
      another" to enter several items quickly.
- [x] Item page for custom items (moved here from FC-19): edit the item fields in place (autosave, like the
      overrides), the copy-details fields, photo upload.
- [x] Cover upload for **overrides** of provider items too (FC-15 / FC-19 accept only an image URL until this
      bucket exists). Serve uploads through the `custom-images` bucket host only; don't widen `remotePatterns`.
- [x] Search page: drop the "Funko Pops — Coming soon" tab. Add "Can't find it? Add manually" to every
      integrated category, opening the same form with that category (moved here from FC-17).
- [x] Dashboard: replace the Funko card with a "Custom collections" card (items and copies per collection).
- [x] Remove "Funko Pops" from the app description (`layout.tsx`) and other copy.

### Docs
- [x] Update `tasks/README.md` (product summary, v1 scope, backlog), `CLAUDE.md` (core / collection packages)
      and the README if it mentions Funko.

## Acceptance criteria
- A user can create several custom collections (e.g. "Funko Pops" and "LEGO"), rename, reorder and delete them.
- A user can add an item to a collection with a title, number, year, maker, description, condition and photo, and
  it shows up in the gallery, item page and dashboard like any other item.
- Filtering by a collection shows only its items, with correct counts.
- A collection or item created in the browser appears in the desktop app without a reload (realtime).
- Deleting a collection deletes its items; deleting an item can be undone.
- Collections and their items are only readable by their owner. Uploaded images can only be listed, uploaded,
  replaced and deleted by their owner; they are served by public, unguessable URLs (decided during FC-13, like the
  avatars bucket). RLS tests in `pnpm test:rls`.

## Notes
- Keep images small to stay within free-tier storage (1 GB).
- **Backlog:** user-defined fields per collection (a field list on `custom_collections` with name and type:
  text / number / date / yes-no / choice, stored in `custom_data.fields`). The fixed basic fields above are
  chosen so this can be added later without migrating data.
- **Backlog:** collection templates (e.g. "Funko Pops" pre-filled with icon and suggested tags), sharing a
  collection publicly, and a community Funko database / API integration.
- CSV / PDF export (FC-25, FC-26) should include the collection name as a column / section heading.
- **Decisions made during implementation (2026-10-14):**
  - The `custom-images` bucket is public (random UUID file names, owner-only list/write), and items store the full
    public URL, not a path. FC-34 uses the same bucket for posters.
  - Each collection has its own page, `/collections/[id]`; the gallery also filters by `collection=` (the
    `customCollectionIds` filter is a list, like the other filters).
  - Collections are reordered by drag and drop in the sidebar (`@dnd-kit`, keyboard included).
  - `collection_stats` gained a `custom_collection_id` column instead of a second stats RPC.
  - Custom items are edited through `merge_item_custom_data` (per-field autosave, no overrides).
  - `collection_items_provider_category` already allowed `provider = 'custom'` with any category, so the new rule
    (`category = 'custom'` ⇒ `provider = 'custom'`) is its own check, `collection_items_custom_provider`.
  - The image compression lives in the web app (`lib/compress-image.ts`, canvas); the collection package only
    uploads a ready WebP blob, so a mobile app can bring its own compressor.
  - A replaced or reset photo or cover upload is deleted from Storage once the change is saved. Photos of
    deleted items and collections stay (undo needs them), as do uploads left behind in an add form that was
    cancelled; a later cleanup task can remove files no item points at. Deleting the account removes them all.
