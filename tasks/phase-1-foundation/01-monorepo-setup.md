# FC-01 — Monorepo setup & tooling

**Phase:** 1 — Foundation · **Depends on:** — · **Platforms:** web, desktop

## Goal
Create the `fanste-collector` monorepo so the web and desktop apps can share TypeScript packages, with linting,
formatting, type checking and CI in place from day one.

## Subtasks
- [ ] `git init`, add `.gitignore` (node, Next.js, Electron, `.env*` except `.env.example`)
- [ ] Root `package.json` (`name: "fanste-collector"`, `private: true`), pin Node LTS in `.nvmrc` / `engines`
- [ ] pnpm workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`)
- [ ] Turborepo (`turbo.json`) with pipelines: `dev`, `build`, `lint`, `typecheck`, `test`
- [ ] `packages/config`:
  - [ ] `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, path aliases)
  - [ ] Shared ESLint config (typescript-eslint, react, react-hooks, import order)
  - [ ] Shared Tailwind preset (colors, radius, fonts)
- [ ] Prettier config + `format` script
- [ ] Empty package skeletons: `packages/core`, `packages/supabase`, `packages/api-client`, `packages/export`
- [ ] Vitest workspace config; one sample test in `packages/core`
- [ ] Husky + lint-staged (lint + prettier on staged files)
- [ ] GitHub Actions CI: install (pnpm cache) → lint → typecheck → test on every PR
- [ ] Root `README.md`: project intro, prerequisites, how to run each app
- [ ] `.env.example` at root listing all expected variables (filled in by later tasks)

## Acceptance criteria
- `pnpm install && pnpm lint && pnpm typecheck && pnpm test` succeed on a clean clone.
- A package in `packages/*` can be imported by any app via its workspace name (e.g. `@fanste/core`).
- CI runs on pull requests and fails on lint/type errors.

## Notes
- Package scope: `@fanste/*`.
- Keep shared packages free of Next.js/Electron-specific imports so a mobile app can reuse them after v1.
