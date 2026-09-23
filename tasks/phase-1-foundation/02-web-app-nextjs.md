# FC-02 — Web app scaffold (Next.js)

**Phase:** 1 — Foundation · **Depends on:** FC-01 · **Platforms:** web, desktop (via Electron)

## Goal
Scaffold `apps/web` as a Next.js App Router application. It is both the web client and the UI that the Electron
desktop shell loads, and it hosts the API gateway (`/api/*`, see FC-08).

## Subtasks
- [x] Create `apps/web` with Next.js (latest stable, App Router, TypeScript, `src/` dir)
- [x] Configure `transpilePackages` for `@fanste/*` workspace packages
- [x] Tailwind CSS using the shared preset from `packages/config`
- [x] Initialise shadcn/ui (button, input, dialog, dropdown-menu, select, tabs, toast, card, badge, skeleton)
- [x] App layout:
  - [x] Route groups: `(auth)` for sign-in/up, `(app)` for authenticated pages
  - [x] Sidebar/topbar shell with nav: Dashboard, Collection, Search, Scanner (desktop only), Export, Settings
  - [x] Light/dark theme toggle (`next-themes`)
- [x] Placeholder pages for each nav item
- [x] TanStack Query provider
- [x] `lib/platform.ts`: `isDesktop()` helper that detects the Electron preload bridge (`window.fanste`)
- [x] `next/image` remote patterns for provider image hosts (`image.tmdb.org`, `i.discogs.com`, `images.igdb.com`, `cf.geekdo-images.com`)
- [x] Env handling: typed env module (zod) splitting server-only vs `NEXT_PUBLIC_*` vars

## Acceptance criteria
- `pnpm --filter web dev` serves the app shell with working navigation and theme toggle.
- The Scanner nav item is hidden in a normal browser and visible when running inside Electron.
- `pnpm --filter web build` succeeds.

## Notes
- Keep pages as thin wrappers; reusable logic goes into `packages/*` or `apps/web/src/features/*`.

### Implementation notes
- **Versions:** Next.js 16.3 (Turbopack), React 19.3, Tailwind CSS 4.3, shadcn/ui CLI 4 (`radix-nova` style), TanStack
  Query 5, zod 4. Next.js is pinned to an exact version (`16.3.5`, together with `@next/eslint-plugin-next`):
  16.3.6 was younger than pnpm's minimum release age.
- **Env:** the monorepo keeps env files at the root, so `next.config.ts` loads the root `.env*` files (same
  precedence as Next.js, never overriding vars that are already set) and validates them with the zod schemas in
  `src/env/schema.ts`. Every var is optional for now; the task that needs a var makes it required. `src/env/server.ts`
  imports `server-only`, so importing it from a Client Component fails the build.
- **Toast:** shadcn/ui replaced its `toast` component with `sonner`, so `<Toaster />` (sonner) is mounted in the root
  layout; use `toast()` from `sonner`.
- **shadcn/ui:** `components.json` lives in `apps/web`. The CLI can't resolve `${configDir}` in tsconfig paths, so
  `apps/web/tsconfig.json` repeats the `@/*` alias. Its theme tokens are not copied into `globals.css`; they come from
  the shared `@fanste/config/tailwind/theme.css`. Generated components import `cn` from the `cn` package
  (shadcn's clsx + tailwind-merge replacement).
- **Desktop detection:** `useIsDesktop()` (`useSyncExternalStore`) returns `false` during SSR and hydration, then the
  real value, so there are no hydration mismatches. `window.fanste` is typed as `unknown` until FC-03 adds
  `FansteDesktopBridge`. `/scanner` shows a "desktop app only" notice when opened in a browser.
- **transpilePackages** is derived from the `@fanste/*` entries in `apps/web/package.json`, so new workspace
  dependencies are picked up automatically.
- **Typed routes** (`typedRoutes: true`) are on; `typecheck` runs `next typegen && tsc --noEmit`. `next-env.d.ts` is
  generated and git-ignored.
- **Prettier:** `tailwindStylesheet` points `prettier-plugin-tailwindcss` at `apps/web/src/app/globals.css`, so
  theme classes such as `bg-card` sort correctly.
- **CI** now also runs `pnpm build`.
- `next dev` generates `apps/web/AGENTS.md` / `CLAUDE.md` (a pointer to the docs bundled with the installed Next.js
  version). They are committed so the working tree stays clean.
