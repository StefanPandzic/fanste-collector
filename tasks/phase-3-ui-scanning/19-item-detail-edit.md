# FC-19 — Item detail & edit

**Phase:** 3 — Core Interfaces · **Depends on:** FC-14, FC-15, FC-16 · **Platforms:** web, desktop

## Goal
A detail view that combines rich provider metadata (fetched on the fly) with the user's ownership data, and lets the
user edit it.

Movies & TV ship first. The sections and copy-details fields of the other categories moved to their provider
tasks (FC-10 music, FC-11 video games, FC-12 board games, FC-13 Funko).

## Subtasks
- [x] Detail page / modal: large cover, title, subtitle, year, description, genres, creators
- [x] Category-specific sections:
  - [x] Movie/TV: runtime / seasons, director / creators
  - [ ] *(Moved to FC-10)* Music: label, catalog number, country, tracklist
  - [ ] *(Moved to FC-11)* Video game: platforms, developer
  - [ ] *(Moved to FC-12)* Board game: players, playtime, age, weight
  - [ ] *(Moved to FC-13)* Funko: series, number, variant, exclusive
- [x] "My copy" section: format (medium), ownership, quantity, acquired date, purchase price, estimated value, currency, tags, notes — inline editing with validation
- [x] Category-specific copy details (FC-15), editable: movie resolution / HDR / audio channels / file format / audio and subtitle languages / edition / discs / region
  - [ ] *(Moved to FC-11)* game platform / storefront / discs / edition / completeness
  - [ ] *(Moved to FC-10)* music discs / vinyl size / speed / variant / condition
- [x] "Edit metadata" mode for overridable API fields (title, subtitle, year, cover image, description, genres, creators):
  - [x] Overridden fields show an "edited" marker with the original API value on hover
  - [x] "Reset to original" per field and "Reset all"
  - [x] Custom cover: paste a URL
  - [ ] *(Moved to FC-13)* Custom cover: upload an image (FC-13 storage bucket)
- [x] TV seasons editor: one row per TMDB season (owned or not, all or selected episodes, per-season subtitles and overrides) and an "N seasons + M episodes owned" summary
- [x] Multiple copies of the same title (e.g. DVD + 4K) shown together, each with its own details
- [x] Delete with confirmation + undo toast
- [x] "View on provider" link (attribution)
- [x] "Refresh metadata" action (bypasses cache TTL, rate limited) — updates API data only, never user-entered details or overrides

## Acceptance criteria
- Edits save and sync to other devices in real time.
- A user can change a movie from "Blu-ray, 1080p" to "4K UHD Blu-ray, 2160p" or mark a game as "Digital, Steam" (the game part moved to FC-11), and see it immediately in the gallery.
- After "Refresh metadata", user-entered details and overrides are unchanged.
- Detail loads from cache instantly and fetches extended details from the gateway in the background.

## Notes
- **Custom covers (from the FC-15 review):** `metadataOverrides.imageUrl` accepts any `https` URL, but covers
  render through `next/image`, whose `images.remotePatterns` allow only the provider hosts. Render an overridden
  cover with `unoptimized` (or a plain `<img>`) and fall back to the category artwork on error. Never widen
  `remotePatterns` to `**`: that turns `/_next/image` into an open server-side fetch proxy (SSRF). Once the FC-13
  storage bucket exists, uploads can use its host through the optimizer.
- Every field saves on its own (`useAutosave`): pickers at once, text after 800 ms or on blur. The changes go
  through the FC-15 merge functions, so two devices editing different fields of one copy don't clash.
- Copies of one title each have their own page (`/collection/<id>`); the copy switcher links them.
- Delete removes the row at once; "Undo" re-inserts it with the same ID, details, overrides and the tags that
  still exist (`restoreItem`). It fails as a duplicate if the same title and medium was added meanwhile.
- "Refresh metadata" is `POST /api/items/:provider/:externalId/refresh`: 10 per user per 10 minutes, and an
  item fetched less than 5 minutes ago comes from the cache (`REFRESH_LIMITS`).
