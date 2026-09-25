# Fanste Collector

A cross-platform collection tracker for **Movies, TV, Music, Video Games, Board Games and Funko Pops**.

Fanste Collector aggregates metadata from external providers (TMDB, Discogs, IGDB, BoardGameGeek). Users search, add
items to their collection and record what they own. Only external IDs and ownership data are stored in Supabase;
rich metadata is fetched on demand and lightly cached.

v1 ships as a **web app** and a **desktop app** (Windows, macOS). See [`tasks/README.md`](tasks/README.md) for the
full plan, tech stack and conventions.

## Prerequisites

- **Node.js 24 LTS** — the version is pinned in [`.nvmrc`](.nvmrc) (`nvm use` / `fnm use`).
- **pnpm 12** — the exact version is pinned in `packageManager` in [`package.json`](package.json).
  - Node 24: `corepack enable` picks it up automatically.
  - Otherwise: `npm install -g pnpm@12`.
- **Git**.

## Getting started

```sh
git clone <repo-url> fanste-collector
cd fanste-collector
pnpm install          # also installs the Git pre-commit hook
cp .env.example .env.local   # then fill in the values (see comments in the file)
```

## Running the apps

| App     | Command                 | Available from |
| ------- | ----------------------- | -------------- |
| Web     | `pnpm --filter web dev` | FC-02          |
| Desktop | `pnpm dev:desktop`      | FC-03          |
| All     | `pnpm dev`              |                |

The web app runs at <http://localhost:3000>. Other scripts: `pnpm --filter web build` / `start`.
`pnpm dev:desktop` starts the web dev server and the Electron window together.

### Web app (`apps/web`)

Next.js (App Router) app. It is the browser client, the UI loaded by the Electron desktop shell, and the API gateway
(`/api/*`, FC-08).

```
apps/web/src/
├─ app/
│  ├─ (auth)/        # sign-in, sign-up — public pages
│  ├─ (app)/         # dashboard, collection, search, scanner, export, settings — app shell (sidebar + topbar)
│  └─ api/           # API gateway route handlers — FC-08
├─ components/
│  ├─ ui/            # shadcn/ui components (generated, see below)
│  └─ app-shell/     # sidebar, topbar, nav, theme toggle
├─ features/         # feature modules (hooks, components, logic) — added by later tasks
├─ env/              # typed env vars (zod): `server.ts` (secrets), `client.ts` (NEXT_PUBLIC_*)
└─ lib/              # small helpers, e.g. `platform.ts` (`isDesktop()`), `supabase/` (Supabase clients)
```

- **Env vars** are read from the **repository root** `.env.local` (and `.env`, `.env.development`, …). Next.js
  normally only reads env files from the app directory, so `next.config.ts` loads the root ones too. Import
  `serverEnv` from `@/env/server` (server code only) or `clientEnv` from `@/env/client` — never read `process.env`
  directly. Invalid values fail `dev`/`build` at startup.
- **Desktop-only UI:** `useIsDesktop()` / `<DesktopOnly>` detect the Electron preload bridge (`window.fanste`). Nav
  items marked `desktopOnly` (the Scanner) are hidden in the browser.
- **shadcn/ui:** add components with `pnpm dlx shadcn@latest add <name>` from `apps/web`. The theme tokens come from
  `@fanste/config/tailwind/theme.css`; if the CLI adds a `:root { … }` / `@theme` block to `globals.css`, move new
  tokens into the shared theme instead.
- **Typed routes** are on: `<Link href>` is checked against the app's routes. `pnpm typecheck` runs `next typegen`
  first to generate the route types.

### Desktop app (`apps/desktop`)

Electron shell, built with [electron-vite](https://electron-vite.org). The window loads the web app (the Next.js dev
server in development, `DESKTOP_WEB_URL` in production builds) — there is no separate desktop UI.

```
apps/desktop/src/
├─ main/       # main process: window, security, deep links (fanste://), IPC handlers
├─ preload/    # exposes `window.fanste` (type: `FansteDesktopBridge` in @fanste/core)
└─ shared/     # used by both, e.g. IPC channel names
```

- **Adding a desktop feature:** extend `FansteDesktopBridge` in `packages/core/src/desktop-bridge.ts`, add the IPC
  channel in `src/shared/ipc-channels.ts`, implement it in the preload and register the handler in
  `src/main/ipc.ts`. Handlers only accept calls from the app origin; validate arguments there too.
- **Security:** the renderer runs with `contextIsolation`, `sandbox` and no `nodeIntegration`, so only
  `window.fanste` is reachable. The window stays on the web app's origin; other links open in the system browser.
- **Dependencies:** main and preload are bundled, so add packages to `devDependencies`. Only packages that must ship
  unbundled (native modules) go in `dependencies`.
- **Env:** `DESKTOP_*` vars from the root env files are inlined at build time (see `.env.example`).
- **Scripts:** `pnpm --filter desktop build` (bundle to `out/`), `preview` (run the build), `package` (installer via
  electron-builder, finalised in FC-29).
- Running from a VS Code _extension_ terminal (e.g. a coding agent)? Unset `ELECTRON_RUN_AS_NODE`, which VS Code sets
  and makes Electron start as plain Node.js.

## Supabase

The backend is **Supabase Cloud** (free tier) with two projects: `fanste-collector-dev` for developers and CI, and
`fanste-collector-prod` for production (configured in FC-29). There is **no local Supabase stack or Docker
database**. The schema lives in [`supabase/migrations`](supabase/migrations) and is pushed to the cloud project
with the Supabase CLI.

The CLI is a dev dependency. Run it with `pnpm db <command>`, which loads the repo-root `.env*` files first (so
`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` and `SUPABASE_ACCESS_TOKEN` come from `.env.local`).

### Connecting to the dev project

1. Get access to the Supabase organization (ask a maintainer for an invite).
2. Fill the Supabase block of `.env.local` from the dev project's dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → Data API → Project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) and `SUPABASE_SECRET_KEY` (`sb_secret_…`):
     Project Settings → API Keys.
   - `SUPABASE_PROJECT_REF`: the `<ref>` in `https://<ref>.supabase.co`.
   - `SUPABASE_DB_PASSWORD`: the database password (Project Settings → Database, where it can be reset).
3. Sign the CLI in: `pnpm db login` (or set `SUPABASE_ACCESS_TOKEN` to a personal access token).
4. Link the repo to the dev project: `pnpm db:link`.
5. Generate the database types: `pnpm db:types`.

The **secret key bypasses Row Level Security**. It is read only by server code (`apps/web/src/lib/supabase/service.ts`,
guarded by `server-only`), and CI fails if it shows up in the browser bundle (`pnpm check:bundle`).

### Changing the schema

Every schema change is a migration. **Never change tables, policies or functions by hand in the dashboard**: the
scheduled drift check fails when the cloud schema differs from the migrations.

```sh
pnpm db migration new add_tags   # creates supabase/migrations/<timestamp>_add_tags.sql; write the SQL there
pnpm db:push                     # applies pending migrations to the linked project (dev)
pnpm db:types                    # regenerates packages/supabase/src/database.types.ts; commit it
```

- `pnpm db migration list` compares local migrations with the ones applied to the linked project.
- `pnpm db:diff` shows the difference between the migrations and the linked project's `public` schema, and
  `pnpm db:drift` fails when there is one. Both need **Docker** (the CLI builds a temporary shadow database), so
  they usually run in CI (see below).

### Seed data (dev only)

[`supabase/seed.sql`](supabase/seed.sql) holds sample data for the dev project. Push it with the migrations:
`pnpm db:push --include-seed`. The wrapper refuses `--include-seed` and `db reset` unless the CLI is linked to the
dev project (`SUPABASE_PROJECT_REF`). The sample rows arrive with the schema in FC-05.

### Test users

The RLS integration tests (FC-05) sign in as two users of the dev project. Create them under Authentication →
Users → Add user (with "Auto Confirm User"), and put their credentials in `.env.local`
(`SUPABASE_TEST_USER_A_EMAIL`, … see `.env.example`) and in the CI secrets.

### Switching the link to prod

The CLI acts on the linked project, which `pnpm db:link` sets to `SUPABASE_PROJECT_REF` (dev). The CLI reads the
database password from `SUPABASE_DB_PASSWORD`, which `.env.local` sets to the **dev** password. A variable set in
the shell takes precedence over `.env.local`, so set the prod password there for the whole session. Don't pass it
as `--password`, which only applies to that one command and ends up in your shell history.

```powershell
# PowerShell. In bash: `read -rs SUPABASE_DB_PASSWORD && export SUPABASE_DB_PASSWORD`, then
# `unset SUPABASE_DB_PASSWORD` (keeps the password out of the shell history).
$env:SUPABASE_DB_PASSWORD = '<prod-db-password>'
pnpm db link --project-ref <prod-ref>
pnpm db:push                     # --include-seed is refused while linked to prod
Remove-Item Env:SUPABASE_DB_PASSWORD
pnpm db:link                     # link back to dev right away
```

### CI

- **CI** (`.github/workflows/ci.yml`) needs no Supabase secrets. After the build it checks that no server-only
  secret reached the client bundle.
- **DB drift** (`.github/workflows/db-drift.yml`) runs twice a week and on demand (Actions → DB drift → Run
  workflow). It links the dev project and runs `pnpm db:drift`. The scheduled runs also keep the free dev project
  from pausing.
- Repository secrets (Settings → Secrets and variables → Actions): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`
  and `SUPABASE_DB_PASSWORD` for the drift check, and the four `SUPABASE_TEST_USER_*` values for the RLS tests
  (FC-05).

### Free tier

- 500 MB database and 1 GB storage are enough: only IDs, user data and a small metadata cache are stored.
- Free projects **pause after about a week without activity**. If the dev project is paused, restore it from the
  dashboard.
- There is no point-in-time recovery. The migrations in the repo and the CSV export (FC-25) are the safety net.

## Scripts

Run from the repository root. Tasks run through [Turborepo](https://turborepo.com) across every workspace package.

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start every app in dev mode                   |
| `pnpm dev:desktop`  | Start the desktop app (and the web app)       |
| `pnpm build`        | Build every app and package                   |
| `pnpm lint`         | ESLint in every package                       |
| `pnpm typecheck`    | `tsc --noEmit` in every package               |
| `pnpm test`         | Vitest in every package that has tests        |
| `pnpm test:watch`   | Vitest watch mode across all projects         |
| `pnpm format`       | Format the repo with Prettier                 |
| `pnpm format:check` | Check formatting without writing (used by CI) |
| `pnpm check:bundle` | Check the web build for leaked server secrets |
| `pnpm db <command>` | Supabase CLI with the root env loaded         |
| `pnpm db:link`      | Link the CLI to the dev project               |
| `pnpm db:push`      | Apply migrations to the linked project        |
| `pnpm db:types`     | Regenerate the database types                 |
| `pnpm db:diff`      | Diff migrations vs. the linked DB (Docker)    |
| `pnpm db:drift`     | Fail on schema drift (Docker, runs in CI)     |

Run a script in one package with `pnpm --filter <name> <script>`, e.g. `pnpm --filter @fanste/core test`.

A pre-commit hook (Husky + lint-staged) runs ESLint `--fix` and Prettier on staged files. CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs format check, lint, typecheck and tests on every pull
request.

## Repository layout

```
fanste-collector/
├─ apps/
│  ├─ web/        # Next.js app + API gateway (/api/*)            — FC-02
│  └─ desktop/    # Electron shell (main + preload), scanner      — FC-03
├─ packages/
│  ├─ core/       # @fanste/core — normalized types, zod schemas, filename parser, constants
│  ├─ supabase/   # @fanste/supabase — Supabase client factory + generated DB types
│  ├─ api-client/ # @fanste/api-client — typed client for the gateway
│  ├─ export/     # @fanste/export — CSV / PDF builders
│  └─ config/     # @fanste/config — tsconfig, ESLint and Tailwind presets
├─ supabase/      # CLI config, migrations + seed                 — FC-04
├─ scripts/       # repo tooling: Supabase CLI wrapper, bundle check
└─ tasks/         # v1 task plan
```

### Shared packages

Workspace packages are consumed **from TypeScript source** (no build step). To use one from an app, add it as a
dependency and import it by name:

```jsonc
// apps/web/package.json
"dependencies": { "@fanste/core": "workspace:*" }
```

```ts
import { APP_NAME } from '@fanste/core';
```

Keep shared packages free of Next.js- and Electron-specific imports so a future mobile app can reuse them. Inside
`packages/*`, use relative imports — the `@/` alias is only for apps.

### Shared config (`@fanste/config`)

| Export                                 | Use in                                               |
| -------------------------------------- | ---------------------------------------------------- |
| `@fanste/config/tsconfig.base.json`    | Apps (`"extends"`); provides `@/*` → `src/*`         |
| `@fanste/config/tsconfig.library.json` | Shared packages (`"extends"`)                        |
| `@fanste/config/eslint/base`           | `eslint.config.js` in non-React packages             |
| `@fanste/config/eslint/react`          | `eslint.config.js` in React apps/packages            |
| `@fanste/config/tailwind/theme.css`    | `@import` after `tailwindcss` in an app's global CSS |

Tailwind CSS v4 is configured in CSS, so the shared "preset" is a theme stylesheet:

```css
@import 'tailwindcss';
@import '@fanste/config/tailwind/theme.css';
```
