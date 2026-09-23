# FC-07 — Normalized item model

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-01 · **Platforms:** shared (`packages/core`)

## Goal
Define one uniform TypeScript interface that every provider response is converted into, so UI components never deal
with provider-specific payloads (SRS §5 Phase 2).

## Subtasks
- [ ] In `packages/core/src/models`:
  - [ ] `ItemCategory`, `MetadataProvider`, `OwnershipStatus` (mirror DB enums; single source of truth + DB-type compatibility test)
  - [ ] `NormalizedItem`:
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
  - [ ] Category-specific `extra` types (`MovieExtra`, `TvExtra`, `MusicExtra`, `VideoGameExtra`, `BoardGameExtra`, `FunkoExtra`)
  - [ ] `SearchResult` (lightweight `NormalizedItem` subset for result lists) and `SearchResponse` with pagination
  - [ ] `CollectionItem` (DB row + joined `NormalizedItem` metadata + `details` + `metadataOverrides`) used by the UI
- [ ] Zod schemas for all of the above (used for gateway responses and form validation)
- [ ] Constants: supported formats (media) per category — the full option lists and per-category copy details are defined in FC-15
- [ ] Mapper helpers: `toMetadataCacheRow(item)` / `fromMetadataCacheRow(row)`
- [ ] Unit tests for schemas and mappers

## Acceptance criteria
- All provider integrations (FC-09…FC-13) return `NormalizedItem` / `SearchResult` only.
- Types compile in the web app, the gateway and the Electron app without platform-specific imports.

## Notes
- `externalId` is always a string (TMDB and BGG IDs are numeric, Discogs uses `release`/`master` prefixes → encode as `release:123`).
