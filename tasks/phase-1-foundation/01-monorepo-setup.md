# FC-01 — Monorepo setup & tooling

**Phase:** 1 — Foundation · **Depends on:** — · **Platforms:** web, desktop

## Goal
Create the `fanste-collector` monorepo so the web and desktop apps can share TypeScript packages, with linting,
formatting, type checking and CI in place from day one.

## Subtasks
- [x] `git init`, add `.gitignore` (node, Next.js, Electron, `.env*` except `.env.example`)
- [x] Root `package.json` (`name: "fanste-collector"`, `private: true`), pin Node LTS in `.nvmrc` / `engines`
- [x] pnpm workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`)
- [x] Turborepo (`turbo.json`) with pipelines: `dev`, `build`, `lint`, `typecheck`, `test`
- [x] `packages/config`:
  - [x] `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, path aliases)
  - [x] Shared ESLint config (typescript-eslint, react, react-hooks, import order)
  - [x] Shared Tailwind preset (colors, radius, fonts)
- [x] Prettier config + `format` script
- [x] Empty package skeletons: `packages/core`, `packages/supabase`, `packages/api-client`, `packages/export`
- [x] Vitest workspace config; one sample test in `packages/core`
- [x] Husky + lint-staged (lint + prettier on staged files)
- [x] GitHub Actions CI: install (pnpm cache) → lint → typecheck → test on every PR
- [x] Root `README.md`: project intro, prerequisites, how to run each app
- [x] `.env.example` at root listing all expected variables (filled in by later tasks)

## Acceptance criteria
- `pnpm install && pnpm lint && pnpm typecheck && pnpm test` succeed on a clean clone.
- A package in `packages/*` can be imported by any app via its workspace name (e.g. `@fanste/core`).
- CI runs on pull requests and fails on lint/type errors.

## Notes
- Package scope: `@fanste/*`.
- Keep shared packages free of Next.js/Electron-specific imports so a mobile app can reuse them after v1.

### Implementation notes
- **Versions:** Node 24 LTS, pnpm 12, Turborepo 2, Vitest 5, Prettier 3.
  - **TypeScript is pinned to `~6.0`**, not 7: typescript-eslint supports only `<6.1`.
  - **ESLint is pinned to `^9.39`**, not 10: `eslint-plugin-react` does not support ESLint 10 yet. Upgrade both
    once the plugins catch up.
- **Tailwind preset:** Tailwind v4 is configured in CSS, so the preset is `@fanste/config/tailwind/theme.css`
  (shadcn/ui token names, class-based dark mode). Apps `@import` it after `tailwindcss`.
- **tsconfig:** `tsconfig.base.json` (apps) maps `@/*` → `<project>/src/*` via `${configDir}`.
  `tsconfig.library.json` (shared packages) turns the alias off, because packages are compiled from source by
  their consumers and `@/` would resolve against the consumer.
- **Vitest:** uses `test.projects` in the root `vitest.config.ts` (the replacement for the deprecated
  `vitest.workspace` file).
- **Packages** are consumed from TypeScript source (`exports` → `./src/index.ts`) with no build step.
- **pnpm build scripts:** pnpm blocks dependency install scripts by default. `allowBuilds` in
  `pnpm-workspace.yaml` records the decision for each package that has one.
- **Prettier** skips `tasks/`, so it doesn't rewrite the planning docs. CI also runs `pnpm format:check`.
