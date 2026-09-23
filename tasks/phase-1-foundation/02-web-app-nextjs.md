# FC-02 — Web app scaffold (Next.js)

**Phase:** 1 — Foundation · **Depends on:** FC-01 · **Platforms:** web, desktop (via Electron)

## Goal
Scaffold `apps/web` as a Next.js App Router application. It is both the web client and the UI that the Electron
desktop shell loads, and it hosts the API gateway (`/api/*`, see FC-08).

## Subtasks
- [ ] Create `apps/web` with Next.js (latest stable, App Router, TypeScript, `src/` dir)
- [ ] Configure `transpilePackages` for `@fanste/*` workspace packages
- [ ] Tailwind CSS using the shared preset from `packages/config`
- [ ] Initialise shadcn/ui (button, input, dialog, dropdown-menu, select, tabs, toast, card, badge, skeleton)
- [ ] App layout:
  - [ ] Route groups: `(auth)` for sign-in/up, `(app)` for authenticated pages
  - [ ] Sidebar/topbar shell with nav: Dashboard, Collection, Search, Scanner (desktop only), Export, Settings
  - [ ] Light/dark theme toggle (`next-themes`)
- [ ] Placeholder pages for each nav item
- [ ] TanStack Query provider
- [ ] `lib/platform.ts`: `isDesktop()` helper that detects the Electron preload bridge (`window.fanste`)
- [ ] `next/image` remote patterns for provider image hosts (`image.tmdb.org`, `i.discogs.com`, `images.igdb.com`, `cf.geekdo-images.com`)
- [ ] Env handling: typed env module (zod) splitting server-only vs `NEXT_PUBLIC_*` vars

## Acceptance criteria
- `pnpm --filter web dev` serves the app shell with working navigation and theme toggle.
- The Scanner nav item is hidden in a normal browser and visible when running inside Electron.
- `pnpm --filter web build` succeeds.

## Notes
- Keep pages as thin wrappers; reusable logic goes into `packages/*` or `apps/web/src/features/*`.
