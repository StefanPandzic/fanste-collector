# Fanste Collector — v1.0 Task Plan

Fanste Collector is a cross-platform collection tracker for **Movies, TV, Music, Video Games, Board Games and Funko Pops**.
It acts as an API aggregator: users search external metadata providers (TMDB, Discogs, IGDB, BoardGameGeek), add items
to their collection, and the app stores only **external IDs + user ownership data** in Supabase, while rich metadata is
fetched (and lightly cached) on demand.

Source: `OmniCollect Software Specification.pdf` (SRS, Development Phase 1.0). "OmniCollect" was the working title;
the product name is **Fanste Collector**.

v1 targets **the web app and the desktop app (Windows, macOS)**. The mobile app is planned for a later version.

---

## Tech stack (v1 decisions)

| Area | Choice | Notes |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | One codebase, shared packages |
| Language | **TypeScript** (strict) everywhere | |
| Web app | **Next.js (App Router)** | Also hosts the API gateway (Route Handlers) |
| Desktop | **Electron** shell that loads the Next.js web app | Adds the local file scanner via a secure preload bridge |
| Styling | **Tailwind CSS + shadcn/ui** | Shared design tokens |
| Backend | **Supabase Cloud** (hosted PostgreSQL, Auth, Realtime, Storage) | Free tier; separate `dev` and `prod` cloud projects; no local Docker DB |
| Data fetching | **TanStack Query** | |
| Validation | **Zod** | Shared schemas in `packages/core` |
| Export | **PapaParse** (CSV), **jsPDF** (PDF) | Client-side only |
| Testing | **Vitest** (unit/integration), **Playwright** (web e2e + Electron smoke) | |

### Deviation from the SRS (intentional)
The SRS proposes Expo + Electron with plain React. For v1 we use **Next.js** for web/desktop because its server-side
Route Handlers give us a place to:
- keep API secrets (TMDB, Discogs, Twitch/IGDB, BGG) off the client,
- centralise rate limiting and caching (SRS §4.1),
- convert BGG XML to JSON (SRS §4 "Needs Parser"),
- avoid CORS problems with third-party APIs.

The web UI and the Electron app both call this gateway. It also accepts bearer tokens, so a future mobile app can
reuse it without changes.

---

## Repository layout (target)

```
fanste-collector/
├─ apps/
│  ├─ web/        # Next.js app + API gateway (/api/*)
│  └─ desktop/    # Electron shell (main + preload), scanner
├─ packages/
│  ├─ core/       # Normalized types, zod schemas, filename parser, constants
│  ├─ supabase/   # Supabase client factory + generated DB types
│  ├─ api-client/ # Typed client for the gateway
│  ├─ export/     # CSV / PDF builders
│  └─ config/     # tsconfig, eslint, tailwind presets
├─ supabase/      # migrations + seed, applied to Supabase Cloud via CLI
└─ tasks/         # this folder
```

---

## v1 scope

**In scope**
- Web app (modern browsers) and desktop app (Windows, macOS)
- Email/password + Google sign-in, instant sync between browser and desktop via Supabase Realtime (SRS §3.1)
- Categories: Movies & TV (TMDB), Physical Music (Discogs), Video Games (IGDB), Board Games (BGG), Funko Pops (manual entry)
- Unified search, add to collection, ownership/format/tags/value/acquisition date
- Data is filled automatically from the APIs (and the scanner), but users can edit it by hand: per-copy details such as movie resolution/edition/discs or game platform/medium/storefront (Steam, …), plus overrides of API fields like title or cover (FC-15)
- Dashboard, gallery, filtering, item detail
- Desktop-only local media scanner with regex parsing, TMDB auto-match and "Fix Match" UI (SRS §3.2)
- CSV and PDF export generated on the client (SRS §3.3)
- Rate limiting + metadata caching (SRS §4.1)
- Production deployment: web app + Supabase Cloud prod project, Windows and macOS installers via GitHub Releases

**Out of scope for v1 (backlog)**
- Mobile app (iOS/Android, Expo React Native)
- Publishing to Google Play and the Apple App Store
- Apple sign-in (optional, only if an Apple Developer account is available — see FC-06)
- Spotify / digital music (listed in the SRS but not in its roadmap; needs its own OAuth flow)
- Automatic Funko metadata (no official public API)
- Barcode scanning, price tracking, public/shared collections, offline mode
- RAWG fallback for games (optional stretch inside FC-11)

---

## Task index

Status legend: `TODO` · `IN PROGRESS` · `DONE` · `BLOCKED`

### Phase 1 — Foundation (Week 1)
| ID | Task | Depends on | Status |
|---|---|---|---|
| FC-01 | [Monorepo setup & tooling](phase-1-foundation/01-monorepo-setup.md) | — | DONE |
| FC-02 | [Web app scaffold (Next.js)](phase-1-foundation/02-web-app-nextjs.md) | FC-01 | DONE |
| FC-03 | [Desktop shell (Electron)](phase-1-foundation/03-desktop-app-electron.md) | FC-02 | DONE |
| FC-04 | [Supabase Cloud project & tooling](phase-1-foundation/04-supabase-setup.md) | FC-01 | TODO |
| FC-05 | [Database schema & RLS](phase-1-foundation/05-database-schema.md) | FC-04 | TODO |
| FC-06 | [Authentication](phase-1-foundation/06-authentication.md) | FC-02, FC-03, FC-05 | TODO |

### Phase 2 — API & Data Modeling (Week 2)
| ID | Task | Depends on | Status |
|---|---|---|---|
| FC-07 | [Normalized item model](phase-2-api-data/07-normalized-item-model.md) | FC-01 | TODO |
| FC-08 | [API gateway, rate limiting & caching](phase-2-api-data/08-api-gateway.md) | FC-02, FC-05, FC-07 | TODO |
| FC-09 | [TMDB integration (Movies & TV)](phase-2-api-data/09-tmdb-integration.md) | FC-08 | TODO |
| FC-10 | [Discogs integration (Physical Music)](phase-2-api-data/10-discogs-integration.md) | FC-08 | TODO |
| FC-11 | [IGDB integration (Video Games)](phase-2-api-data/11-igdb-integration.md) | FC-08 | TODO |
| FC-12 | [BoardGameGeek integration + XML parser](phase-2-api-data/12-bgg-integration.md) | FC-08 | TODO |
| FC-13 | [Funko Pops / custom items](phase-2-api-data/13-funko-custom-items.md) | FC-05, FC-07 | TODO |
| FC-14 | [Collection data layer & realtime sync](phase-2-api-data/14-collection-data-layer.md) | FC-06, FC-07 | TODO |
| FC-15 | [Item details & manual overrides](phase-2-api-data/15-item-details-overrides.md) | FC-05, FC-07, FC-14 | TODO |

### Phase 3 — Core Interfaces & Desktop Scanning (Week 3)
| ID | Task | Depends on | Status |
|---|---|---|---|
| FC-16 | [Design system & shared UI](phase-3-ui-scanning/16-design-system.md) | FC-02 | TODO |
| FC-17 | [Unified search & add item](phase-3-ui-scanning/17-search-add-item.md) | FC-09–FC-16 | TODO |
| FC-18 | [Collection gallery & filters](phase-3-ui-scanning/18-collection-gallery-filters.md) | FC-14, FC-15, FC-16 | TODO |
| FC-19 | [Item detail & edit](phase-3-ui-scanning/19-item-detail-edit.md) | FC-14, FC-15, FC-16 | TODO |
| FC-20 | [Dashboard](phase-3-ui-scanning/20-dashboard.md) | FC-14, FC-16 | TODO |
| FC-21 | [Scanner: directory ingestion](phase-3-ui-scanning/21-scanner-directory-ingestion.md) | FC-03, FC-05 | TODO |
| FC-22 | [Scanner: filename parser](phase-3-ui-scanning/22-scanner-filename-parser.md) | FC-07 | TODO |
| FC-23 | [Scanner: background TMDB matching](phase-3-ui-scanning/23-scanner-background-matching.md) | FC-09, FC-15, FC-21, FC-22 | TODO |
| FC-24 | [Scanner: "Fix Match" UI](phase-3-ui-scanning/24-scanner-fix-match-ui.md) | FC-23 | TODO |

### Phase 4 — Export Tools & Polish (Week 4)
| ID | Task | Depends on | Status |
|---|---|---|---|
| FC-25 | [CSV export](phase-4-export-polish/25-csv-export.md) | FC-14, FC-15 | TODO |
| FC-26 | [PDF catalog export](phase-4-export-polish/26-pdf-export.md) | FC-14, FC-15 | TODO |
| FC-27 | [Branding & provider attribution](phase-4-export-polish/27-branding-attribution.md) | FC-16 | TODO |
| FC-28 | [Testing & cross-platform QA](phase-4-export-polish/28-testing-qa.md) | Phase 3 | TODO |
| FC-29 | [Production builds & release](phase-4-export-polish/29-release-builds.md) | FC-28 | TODO |

---

## Conventions

- One task = one branch = one PR, named `fc-XX-short-name`.
- Each task file has: **Goal**, **Subtasks** (checkboxes), **Acceptance criteria**, **Notes**. Tick checkboxes as work lands.
- Secrets live only in `.env.local` / hosting env vars, never in the repo. Keep `.env.example` up to date.
- Database changes go only through migrations in `supabase/migrations`, pushed with the Supabase CLI — never by hand in the Supabase dashboard.
- Shared logic belongs in `packages/*`; apps only hold platform-specific UI and wiring.

## Definition of Done (every task)
- [ ] Acceptance criteria met
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass in CI
- [ ] New env vars added to `.env.example`
- [ ] Schema changes pushed to the dev Supabase Cloud project and types regenerated
- [ ] Status updated in this README
