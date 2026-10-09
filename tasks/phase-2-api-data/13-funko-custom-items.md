# FC-13 — Funko Pops / custom items

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-05, FC-07 · **Category:** `funko` (+ any category as fallback)

## Goal
Funko Pops are part of the product scope but there is no official public API. In v1 they are added as **custom items**
(`provider = 'custom'`), and the same flow lets users add any item a provider doesn't have.

## Subtasks
- [ ] `FunkoExtra` fields (describe the product): series/line, number (e.g. #123), franchise, exclusive, variant (chase, flocked, glow)
- [ ] Copy-level fields live in `details` like every other category (FC-15 shipped Movies & TV only): add a
      `FunkoDetails` schema in `packages/core/src/models/copy-details.ts` (replaces the loose record) with
      `boxCondition` (Mint, Near mint, Damaged, Out of box), `sticker` (exclusive / convention sticker) and
      `protector`, its patch schema and `parseDetails` branch, and the medium (Physical) in `FORMATS_BY_CATEGORY`
- [ ] Custom cover upload for **overrides** of provider items too (FC-15 accepts only an image URL in
      `metadataOverrides.imageUrl` until this bucket exists)
- [ ] Zod schema for custom item input: title (required), category, image, year, description + category `extra`
- [ ] Image upload for custom items:
  - [ ] Supabase Storage bucket `custom-images` (per-user folder, RLS policies, max 1 MB, client-side resize/compress to WebP)
  - [ ] Or paste an image URL
- [ ] Store in `collection_items.custom_data`; normalize to `NormalizedItem` on read
- [ ] "Can't find it? Add manually" entry point in search (FC-17) for all categories

## Acceptance criteria
- A user can add a Funko Pop with a name, number, series and photo, and it shows up in the gallery like any other item.
- Custom item images are only readable by the owner.

## Notes
- Keep images small to stay within free-tier storage (1 GB).
- A community Funko database / API integration is a backlog item.
