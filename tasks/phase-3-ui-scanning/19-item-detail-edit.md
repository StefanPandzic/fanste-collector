# FC-19 — Item detail & edit

**Phase:** 3 — Core Interfaces · **Depends on:** FC-14, FC-15, FC-16 · **Platforms:** web, desktop

## Goal
A detail view that combines rich provider metadata (fetched on the fly) with the user's ownership data, and lets the
user edit it.

## Subtasks
- [ ] Detail page / modal: large cover, title, subtitle, year, description, genres, creators
- [ ] Category-specific sections:
  - [ ] Movie/TV: runtime / seasons, director / creators
  - [ ] Music: label, catalog number, country, tracklist
  - [ ] Video game: platforms, developer
  - [ ] Board game: players, playtime, age, weight
  - [ ] Funko: series, number, variant, exclusive
- [ ] "My copy" section: format (medium), ownership, quantity, acquired date, purchase price, estimated value, currency, tags, notes — inline editing with validation
- [ ] Category-specific copy details (FC-15), editable: e.g. movie resolution / HDR / edition / discs / region; game platform / storefront / discs / edition / completeness; music discs / vinyl size / speed / variant / condition
- [ ] "Edit metadata" mode for overridable API fields (title, subtitle, year, cover image, description, genres, creators):
  - [ ] Overridden fields show an "edited" marker with the original API value on hover
  - [ ] "Reset to original" per field and "Reset all"
  - [ ] Custom cover: paste a URL or upload an image (FC-13 storage bucket)
- [ ] Multiple copies of the same title (e.g. DVD + 4K) shown together, each with its own details
- [ ] Delete with confirmation + undo toast
- [ ] "View on provider" link (attribution)
- [ ] "Refresh metadata" action (bypasses cache TTL, rate limited) — updates API data only, never user-entered details or overrides

## Acceptance criteria
- Edits save and sync to other devices in real time.
- A user can change a movie from "Blu-ray, 1080p" to "4K UHD Blu-ray, 2160p" or mark a game as "Digital, Steam", and see it immediately in the gallery.
- After "Refresh metadata", user-entered details and overrides are unchanged.
- Detail loads from cache instantly and fetches extended details from the gateway in the background.
