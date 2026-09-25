# FC-04 — Supabase Cloud project & tooling

**Phase:** 1 — Foundation · **Depends on:** FC-01 · **Platforms:** backend

## Goal
Set up **Supabase Cloud** (hosted PostgreSQL, Auth, Realtime, Storage) on the free tier, with schema migrations
tracked in the repo and applied to the cloud projects via the Supabase CLI. No local Docker database is used.

## Subtasks
- [ ] Create two Supabase Cloud projects (free tier allows two active projects) — manual, see README → Supabase:
  - [ ] `fanste-collector-dev` — used by developers and CI
  - [ ] `fanste-collector-prod` — production (configured in FC-29)
- [ ] Pick the region closest to users (e.g. `eu-central-1`) for both — manual, at project creation
- [x] Install Supabase CLI as a dev dependency; `supabase init` at repo root → `supabase/` folder (migrations, seed)
- [ ] `supabase link --project-ref <dev-ref>`; document how to switch the link to prod — `pnpm db:link` and the docs are done; linking needs the dev project
- [x] Migration workflow (documented in README):
  - [x] `supabase migration new <name>` → write SQL (`pnpm db migration new <name>`)
  - [x] `supabase db push` → apply to the linked cloud project (`pnpm db:push`)
  - [x] Never edit the schema by hand in the dashboard; every change goes through a migration (enforced by the scheduled `DB drift` workflow)
- [x] Type generation script: `pnpm db:types` (`supabase gen types typescript --project-id <dev-ref>`) → `packages/supabase/src/database.types.ts` (generated from the dev project; excluded from ESLint)
- [x] `packages/supabase`:
  - [x] `createBrowserClient()` for the web app (`@supabase/ssr`)
  - [x] `createServerClient()` for Next.js server components / route handlers (cookie-based)
  - [x] `createServiceClient()` (secret key, server-only) for writing to the metadata cache
- [x] Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` and `SUPABASE_ACCESS_TOKEN` (CLI only). The new publishable/secret keys replace the deprecated anon/service_role keys.
- [x] Seed data (`supabase/seed.sql`): sample items for the dev project only (`supabase db push --include-seed` on dev) — placeholder file and workflow; the sample rows arrive with the schema in FC-05
- [ ] Two test users in the dev project for integration/RLS tests; credentials stored as CI secrets — manual (env var names `SUPABASE_TEST_USER_{A,B}_{EMAIL,PASSWORD}` are in `.env.example`)
- [ ] Share dev project access with the team (Supabase organization members) — manual

## Acceptance criteria
- A new developer can clone the repo, fill `.env.local` with dev project keys, run `pnpm db:types`, and use the dev backend.
- Migrations in `supabase/migrations` fully describe the cloud schema (`supabase db diff` shows no drift; checked by the `DB drift` workflow, since `db diff` needs Docker).
- The secret key is never bundled into client code (verify with a build search: `pnpm check:bundle`, run in CI).

## Notes
- Free tier: 500 MB database, 1 GB storage. We only store IDs, user state and a small metadata cache, so this is enough (SRS §2).
- Free projects pause after about a week without activity. Resume the dev project from the dashboard if needed; prod must stay active (a scheduled health-check ping is enough). The twice-weekly `DB drift` run keeps the dev project active.
- The free tier has no point-in-time recovery; migrations in the repo plus the CSV export (FC-25) are the safety net.
