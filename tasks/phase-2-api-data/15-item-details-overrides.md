# FC-15 — Item details & manual overrides

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-05, FC-07, FC-14 · **Platforms:** web, desktop

## Goal
Collection data is **filled automatically from the provider APIs** (and from the desktop scanner), but the user can
**edit, replace and add information by hand**. Two kinds of data are editable:

1. **Copy details** — facts about *the user's own copy* that no API knows reliably, for example:
   - Movie: resolution (1080p / 4K), medium (DVD, Blu-ray, 4K UHD, digital file), edition, number of discs
   - Video game: medium (disc, cartridge, digital), storefront (Steam, Epic, GOG, PlayStation Store…), platform, number of discs
   - Music: medium (CD, vinyl, cassette), number of discs, vinyl color, condition
2. **Metadata overrides** — corrections to API data, e.g. a different title, release year or custom cover image.

## Data rules
| Data | Where it lives | Filled by | Editable | Touched by "refresh metadata"? |
|---|---|---|---|---|
| Provider metadata (title, year, cover, …) | `metadata_cache` (shared) | API | No (use overrides) | Yes |
| Metadata overrides | `collection_items.metadata_overrides` (jsonb) | User | Yes, per field, with "reset to original" | **Never** |
| Copy details | `collection_items.details` (jsonb) + `format` column | Prefilled from API / scanner when the item is added, then owned by the user | Yes | **Never** |

Displayed values are always `{ ...providerMetadata, ...metadataOverrides }`.

## Copy details per category (v1)
All fields are optional. Option lists live in `packages/core/src/constants` and must also allow a free-text "Other" value.

| Category | `format` (medium, top-level column) | `details` fields |
|---|---|---|
| Movie | DVD, Blu-ray, 4K UHD Blu-ray, VHS, Digital file, Digital store | `resolution` (480p, 576p, 720p, 1080p, 2160p), `hdr` (none, HDR10, HDR10+, Dolby Vision), `audioChannels` (1.0, 2.0, 2.1, 5.1, 6.1, 7.1, 7.1.4), `fileFormat` (only for `Digital file`: MKV, MP4, AVI, MOV, M4V, WMV, M2TS, TS, WebM, ISO, VIDEO_TS, BDMV), `edition` (Standard, Collector's, Steelbook, Director's Cut, …), `discCount`, `region` (A/B/C, 1–6), `audioLanguages[]` (one or more, the first is the main language), `subtitleLanguages[]` (zero or more), `digitalStore` (Apple TV, Google Play, Amazon, …) |
| TV | Same as Movie | The Movie fields, as defaults for the whole show, plus `seasons[]` (see "TV seasons" below) |
| Music | Vinyl, CD, Cassette, Digital | `discCount`, `vinylSize` (7", 10", 12"), `speed` (33⅓, 45, 78), `variant` (color / picture disc), `catalogNumber`, `mediaCondition` + `sleeveCondition` (Goldmine grades M, NM, VG+, VG, G, P) |
| Video game | Disc, Cartridge, Digital, Digital code | `platform` (from IGDB platform list), `storefront` (Steam, Epic Games Store, GOG, PlayStation Store, Xbox Store, Nintendo eShop, Battle.net, EA app, Ubisoft Connect, itch.io), `discCount`, `edition` (Standard, Deluxe, GOTY, Collector's), `region` (PAL, NTSC-U, NTSC-J, Region-free), `completeness` (Sealed, CIB, Loose), `dlcNotes` |
| Board game | Physical | `edition`, `language`, `expansionsOwned[]`, `condition`, `sleeved`, `complete` |
| Funko | Physical | `boxCondition` (Mint, Near mint, Damaged, Out of box), `sticker` (exclusive / convention sticker), `protector` |

Languages are stored as ISO 639-1 codes (`en`, `sr`, `ja`, …) and shown with `Intl.DisplayNames`, so the UI
can offer a searchable list and filters (FC-18) match exactly.

### TV seasons
A TV copy records what the user owns, per season. Each `seasons[]` entry is:

| Field | Meaning |
|---|---|
| `seasonNumber` | Matches `TvExtra.seasons[].seasonNumber` from TMDB (`0` = Specials) |
| `episodesOwned` | `'all'`, or a list of episode numbers (e.g. `[1, 2, 5]`). The UI offers `1…episodeCount` from TMDB |
| `audioLanguages[]`, `subtitleLanguages[]` | Optional. Languages of this season when they differ from the show's defaults |
| `resolution`, `audioChannels`, `fileFormat`, `format` | Optional. Per-season overrides (e.g. season 1 on DVD, season 2 as 1080p MKV) |

A season missing from `seasons[]` isn't owned. Helpers: `ownedEpisodeCount(details, tvExtra)` and
`seasonDetails(details, seasonNumber)`, which fills in the show defaults, for the UI and the export.

### When the fields apply
Copy details describe a copy the user has, so the UI shows them for `owned`, `loaned_out` and `preordered`, and
hides them for `wishlist` (and `sold`, read-only). The data is kept when the status changes, so switching
`wishlist` → `owned` and back loses nothing.

Overridable metadata fields: `title`, `subtitle`, `releaseYear`, `imageUrl` (custom cover — URL or upload via the FC-13 storage bucket), `description`, `genres`, `creators`.

## Subtasks
### Model (`packages/core`)
- [ ] Zod schemas per category: `MovieDetails`, `TvDetails`, `MusicDetails`, `VideoGameDetails`, `BoardGameDetails`, `FunkoDetails`, combined as `CopyDetails` (discriminated by category)
- [ ] `MetadataOverrides` schema (partial of the overridable `NormalizedItem` fields)
- [ ] `TvDetails.seasons[]` (`seasonNumber`, `episodesOwned`, per-season language/quality overrides), plus `ownedEpisodeCount()` and `seasonDetails()`
- [ ] Option-list constants (media, resolutions, HDR, audio channels, file formats, storefronts, regions, conditions, editions) with labels; language codes with `Intl.DisplayNames` labels
- [ ] `applyOverrides(item, overrides)` → display item + list of overridden field names (for the "edited" marker)
- [ ] `prefillDetails(category, normalizedItem, context?)` — suggested values when adding an item:
  - [ ] Discogs release: `formats` → `format` (Vinyl / CD / Cassette), `qty` → `discCount`, descriptions → `vinylSize`, `speed`, `variant`; label catalog number → `catalogNumber`
  - [ ] IGDB: if the game has exactly one platform, preselect `platform`; otherwise the user picks from the game's platforms
  - [ ] TMDB TV: the seasons and their episode counts are offered for `seasons[]`
  - [ ] TMDB: the original language is suggested as the first `audioLanguages` entry. This needs `originalLanguage` in `MovieExtra` / `TvExtra`, mapped from TMDB's `original_language` (small change to the FC-09 mapper and fixtures)
  - [ ] BGG: expansions list offered for `expansionsOwned`
  - [ ] Scanner (FC-23): `format: 'Digital file'`; `fileFormat`, `resolution`, `hdr` and `audioChannels` from the filename parser (FC-22); `subtitleLanguages` from sidecar subtitle files (FC-21); for TV, the scanned episodes build `seasons[].episodesOwned`
  - [ ] Otherwise: the user's last-used values for that category (e.g. always 4K UHD) — stored in `profiles.preferences`
- [ ] Unit tests for schemas, `applyOverrides` and `prefillDetails` (Discogs/IGDB fixtures)

### Database (extends FC-05 schema)
- [ ] Columns `collection_items.details`, `collection_items.metadata_overrides` and `profiles.preferences` are defined in the FC-05 schema; this task adds:
  - [ ] Checks: `jsonb_typeof(...) = 'object'`, size limit (e.g. `pg_column_size(details) < 8192`)
  - [ ] GIN index on `details` for filtering (e.g. all 4K movies, all Steam games)
  - [ ] `collection_items_view` returns display values with overrides applied (`coalesce(metadata_overrides->>'title', mc.title)`, …) plus the raw provider values

### Data layer (extends FC-14)
- [ ] `updateItemDetails(id, patch)` and `updateOverrides(id, patch)` — partial jsonb merge, validated with zod before sending
- [ ] `resetOverride(id, field)` / `resetAllOverrides(id)`
- [ ] Metadata refresh updates only `metadata_cache`; add a test proving `details` and `metadata_overrides` stay unchanged

## Acceptance criteria
- Adding a vinyl release from Discogs prefills medium, number of discs and catalog number; the user can change any of them before saving.
- A user can set a movie to "4K UHD Blu-ray, 2160p, Dolby Vision, Steelbook, 2 discs" and a game to "Digital, Steam, PC".
- A user can record a movie file as "Digital file, MKV, 1080p, 5.1, English audio, English + Serbian subtitles".
- A user can record a TV show as "season 1 complete, season 2 episodes 1–4, season 2 with Serbian subtitles", and the item shows "1 full season + 4 episodes".
- A user can override a title or cover; the item shows an "edited" marker and "Reset to original" restores the API value.
- Refreshing metadata from the provider never overwrites user-entered details or overrides.
- The same title owned in two formats (e.g. DVD and 4K) is two copies, each with its own details.

## Notes
- UI for these fields is built in FC-17 (add dialog) and FC-19 (detail/edit); filters in FC-18; export columns in FC-25/FC-26.
- New detail fields can be added later without a migration (jsonb + zod), but keep the zod schemas the single source of truth.
