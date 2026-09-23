# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Fanste Collector is a collection tracker (movies/TV, music, video games, board games, Funko Pops) that aggregates
metadata from TMDB, Discogs, IGDB and BoardGameGeek. Supabase stores only external IDs and ownership data; rich
metadata is fetched on demand. v1 targets web + desktop (Windows, macOS). `README.md` holds the setup guide and
`tasks/README.md` holds the v1 plan, tech stack and task index.

## Where to look

This file covers the whole repo. Each app has its own instructions; read them before changing that app:

| Working on                                                                    | Read                     |
| ----------------------------------------------------------------------------- | ------------------------ |
| Pages, UI components, shadcn/Tailwind, API gateway (`/api/*`), web env vars   | `apps/web/CLAUDE.md`     |
| Electron main/preload, `window.fanste` bridge, scanner, deep links, packaging | `apps/desktop/CLAUDE.md` |
| A desktop feature the web UI calls (e.g. the scanner)                         | Both, desktop first      |
| `packages/*`, tooling, CI, task workflow                                      | This file                |

## Finishing an implementation

When an implementation is done, run two subagents in order, before telling the user the work is finished and
before committing:

1. **`unit-test-writer`** (`.claude/agents/unit-test-writer.md`), if the change added or changed logic. It writes
   basic co-located Vitest tests in the repo's style: main behaviour only, no edge cases. If a test shows a bug in
   the code, report it to the user.
2. **`code-reviewer`** (`.claude/agents/code-reviewer.md`). It reviews every change on the branch against `main`
   (the new tests included) for architecture, structure, security and bugs, and it runs format, lint, typecheck
   and test.

- Relay every 🔴 Security and 🟠 Bug finding to the user, in full, with file and line. Never drop or soften them.
- Fix architecture and structure findings, or explain why a finding doesn't apply.
- After non-trivial fixes, run the reviewer again.
- If the reviewer's verdict is NEEDS CHANGES, don't report the task as done.

## Commands

Node 24 (`.nvmrc`) and pnpm 12 (`packageManager`). Run from the repo root; tasks run through Turborepo.

```sh
pnpm install                 # also installs the Husky pre-commit hook (lint-staged: eslint --fix + prettier)
pnpm dev                     # all apps
pnpm --filter web dev        # Next.js at http://localhost:3000
pnpm dev:desktop             # Electron + the web dev server
pnpm lint | typecheck | test | build
pnpm format / format:check   # Prettier (CI runs format:check)
pnpm --filter <pkg> <script> # one package: web, desktop, @fanste/core, ...
```

Single test file or test name (both verified):

```sh
pnpm vitest run apps/desktop/src/main/url-policy.test.ts          # from root (root vitest.config.ts = projects)
pnpm --filter desktop exec vitest run src/main/url-policy.test.ts -t "isAppUrl"
```

`pnpm test:watch` runs root Vitest in watch mode across all projects. Tests are co-located as `src/**/*.test.ts(x)`.
CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, test and build, and it also checks the
formatting of Markdown files.

## Architecture

**One UI, two shells.** `apps/web` (Next.js) is the browser client, the UI the desktop app shows, and the API
gateway that keeps provider secrets server-side. `apps/desktop` (Electron) has no UI of its own: its window loads
the web app and adds local-only features through the `window.fanste` preload bridge. The bridge's contract type,
`FansteDesktopBridge`, lives in `packages/core/src/desktop-bridge.ts` because both apps depend on it.

**Shared packages (`packages/*`) are consumed as TypeScript source**, with no build step (`exports` points at
`src/index.ts`). To use a package, add `"@fanste/<name>": "workspace:*"` to the app's `package.json`:

- Web picks it up automatically (`transpilePackages` in `next.config.ts`).
- Desktop bundles it (it goes in `devDependencies`, as `apps/desktop/CLAUDE.md` explains).

Keep packages free of Next.js/Electron imports so a future mobile app can reuse them, and use relative imports
inside packages (the `@/*` alias is for apps only). `api-client`, `export` and `supabase` are still empty stubs.
`core` holds constants and the bridge types, and will hold the normalized item model, zod schemas and filename
parser. `config` holds the tsconfig, ESLint and Tailwind presets.

**Env vars live only in the repo-root `.env*` files.** Both apps load them from there. A new variable goes in
`.env.example`, tagged with the FC task that introduces it. How each app reads and validates them is covered in
the app files.

## Conventions

- ESLint (type-aware, flat config per package, root config lints only root files):
  - Use separate `import type` statements (`consistent-type-imports`).
  - Import order is enforced: node builtins → external → `@fanste/*` → `@/` → relative → type imports, with a blank
    line between groups and alphabetized within them.
  - Unused vars need a `_` prefix.
- Prettier: single quotes, trailing commas, 100-character lines, and Tailwind class sorting.
- TS: `strict`, `noUncheckedIndexedAccess`, and `verbatimModuleSyntax`.
- **Task workflow:** one task = one branch = one PR, named `fc-XX-short-name`. Each `tasks/phase-*/NN-*.md` file
  has Goal / Subtasks / Acceptance criteria / Notes:
  - Tick subtask checkboxes as work lands.
  - Update the status in `tasks/README.md` when a task is done.
  - Stubs in code name the task that will implement them (e.g. `notImplemented(... FC-21)`); keep that convention.
- Shared logic belongs in `packages/*`; apps hold only platform-specific UI and wiring.
- Database changes go only through migrations in `supabase/migrations`, pushed with the Supabase CLI to the Supabase
  Cloud dev project, with types regenerated afterwards. There is no local Docker DB. The `supabase/` folder arrives
  with FC-04.
