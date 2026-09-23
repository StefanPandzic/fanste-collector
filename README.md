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

| App     | Command                     | Available from |
| ------- | --------------------------- | -------------- |
| Web     | `pnpm --filter web dev`     | FC-02          |
| Desktop | `pnpm --filter desktop dev` | FC-03          |
| All     | `pnpm dev`                  |                |

## Scripts

Run from the repository root. Tasks run through [Turborepo](https://turborepo.com) across every workspace package.

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start every app in dev mode                   |
| `pnpm build`        | Build every app and package                   |
| `pnpm lint`         | ESLint in every package                       |
| `pnpm typecheck`    | `tsc --noEmit` in every package               |
| `pnpm test`         | Vitest in every package that has tests        |
| `pnpm test:watch`   | Vitest watch mode across all projects         |
| `pnpm format`       | Format the repo with Prettier                 |
| `pnpm format:check` | Check formatting without writing (used by CI) |

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
├─ supabase/      # migrations + seed                             — FC-04
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
