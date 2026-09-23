# FC-04 — Supabase Cloud project & tooling

**Phase:** 1 — Foundation · **Depends on:** FC-01 · **Platforms:** backend

## Goal
Set up **Supabase Cloud** (hosted PostgreSQL, Auth, Realtime, Storage) on the free tier, with schema migrations
tracked in the repo and applied to the cloud projects via the Supabase CLI. No local Docker database is used.

## Subtasks
- [ ] Create two Supabase Cloud projects (free tier allows two active projects):
  - [ ] `fanste-collector-dev` — used by developers and CI
  - [ ] `fanste-collector-prod` — production (configured in FC-29)
- [ ] Pick the region closest to users (e.g. `eu-central-1`) for both
- [ ] Install Supabase CLI as a dev dependency; `supabase init` at repo root → `supabase/` folder (migrations, seed)
- [ ] `supabase link --project-ref <dev-ref>`; document how to switch the link to prod
- [ ] Migration workflow (documented in README):
  - [ ] `supabase migration new <name>` → write SQL
  - [ ] `supabase db push` → apply to the linked cloud project
  - [ ] Never edit the schema by hand in the dashboard; every change goes through a migration
- [ ] Type generation script: `pnpm db:types` (`supabase gen types typescript --project-id <dev-ref>`) → `packages/supabase/src/database.types.ts`
- [ ] `packages/supabase`:
  - [ ] `createBrowserClient()` for the web app (`@supabase/ssr`)
  - [ ] `createServerClient()` for Next.js server components / route handlers (cookie-based)
  - [ ] `createServiceClient()` (service role, server-only) for writing to the metadata cache
- [ ] Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` (CLI only)
- [ ] Seed data (`supabase/seed.sql`): sample items for the dev project only (`supabase db push --include-seed` on dev)
- [ ] Two test users in the dev project for integration/RLS tests; credentials stored as CI secrets
- [ ] Share dev project access with the team (Supabase organization members)

## Acceptance criteria
- A new developer can clone the repo, fill `.env.local` with dev project keys, run `pnpm db:types`, and use the dev backend.
- Migrations in `supabase/migrations` fully describe the cloud schema (`supabase db diff` shows no drift).
- The service role key is never bundled into client code (verify with a build search).

## Notes
- Free tier: 500 MB database, 1 GB storage. We only store IDs, user state and a small metadata cache, so this is enough (SRS §2).
- Free projects pause after about a week without activity. Resume the dev project from the dashboard if needed; prod must stay active (a scheduled health-check ping is enough).
- The free tier has no point-in-time recovery; migrations in the repo plus the CSV export (FC-25) are the safety net.
