# FC-07 — Normalized item model

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-01 · **Platforms:** shared (`packages/core`)

## Goal
Define one uniform TypeScript interface that every provider response is converted into, so UI components never deal
with provider-specific payloads (SRS §5 Phase 2).

## Subtasks
- [x] In `packages/core/src/models`:
  - [x] `ItemCategory`, `MetadataProvider`, `OwnershipStatus` (mirror DB enums; single source of truth + DB-type compatibility test)
  - [x] `NormalizedItem`:
    ```ts
    interface NormalizedItem {
      provider: MetadataProvider;
      externalId: string;
      category: ItemCategory;
      title: string;
      subtitle?: string;        // artist / platform / studio / series
      releaseYear?: number;
      imageUrl?: string;        // poster / cover / box art
      thumbnailUrl?: string;
      description?: string;
      genres?: string[];
      creators?: string[];      // directors, artists, developers, designers
      extra?: Record<string, unknown>; // category-specific (runtime, tracklist, player count, ...)
      sourceUrl?: string;       // link back to provider page (attribution)
    }
    ```
  - [x] Category-specific `extra` types: `MovieExtra`, `TvExtra` (Movies & TV ship first; `MusicExtra` → FC-10, `VideoGameExtra` → FC-11, `BoardGameExtra` → FC-12, `FunkoExtra` → FC-13)
  - [x] `SearchResult` (lightweight `NormalizedItem` subset for result lists) and `SearchResponse` with pagination
  - [x] `CollectionItem` (DB row + joined `NormalizedItem` metadata + `details` + `metadataOverrides`) used by the UI
- [x] Zod schemas for all of the above (used for gateway responses and form validation)
- [x] Constants: supported formats (media) per category — Movie/TV filled in; other categories by FC-10…FC-13. The full option lists and per-category copy details are defined in FC-15
- [x] Mapper helpers: `toMetadataCacheRow(item)` / `fromMetadataCacheRow(row)`
- [x] Unit tests for schemas and mappers

## Acceptance criteria
- All provider integrations (FC-09…FC-13) return `NormalizedItem` / `SearchResult` only.
- Types compile in the web app, the gateway and the Electron app without platform-specific imports.

## Notes
- `externalId` is always a string, in the format the database enforces (FC-05): TMDB `movie:603` / `tv:1396` (movies and TV have separate ID spaces), Discogs `release:123` / `master:123`, IGDB and BGG the plain number.
