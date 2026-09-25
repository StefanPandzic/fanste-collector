@AGENTS.md

# Web app (`apps/web`)

Instructions for the Next.js app. The repo-wide rules are in `../../CLAUDE.md`. For desktop-bridge work, also read
`../desktop/CLAUDE.md`.

The `@AGENTS.md` import above must stay on the first line. `next dev` rewrites only the rules block in `AGENTS.md`,
so this file is safe to edit. Commit the block in `AGENTS.md` too; if you remove it, `next dev` adds it back.

## Commands

```sh
pnpm --filter web dev        # http://localhost:3000
pnpm --filter web build      # production build; `start` serves it
pnpm --filter web typecheck  # runs `next typegen` first (route types), then tsc
pnpm --filter web exec vitest run src/lib/platform.test.ts
```

## Architecture

The app has three roles:

- the browser client
- the UI loaded by the Electron desktop window
- the API gateway, as Route Handlers under `src/app/api/*` (FC-08)

The gateway exists so that provider secrets (TMDB, Discogs, Twitch/IGDB, BGG) never reach the client. It also
does rate limiting, caching and BGG XML→JSON, and avoids CORS. It accepts bearer tokens so a future mobile app can
use it unchanged.

- **Routes:**
  - `(auth)` holds the public pages (sign-in, sign-up).
  - `(app)` holds the pages inside the sidebar/topbar shell (`components/app-shell`).
  - `src/features/` will hold feature modules (hooks, components, logic) as later tasks add them.
  - Nav entries are defined in `components/app-shell/nav-items.ts`.
- **Data fetching** goes through TanStack Query (`components/providers.tsx`). Defaults: 60 s `staleTime`, and no
  refetch on window focus.
- **Cover images** from providers load through `next/image`. The allowed hosts are in `images.remotePatterns` in
  `next.config.ts`; add a provider's image host there.

## Env vars

- `next.config.ts` loads the repo-root `.env*` files, using the same precedence as Next.js. Variables that are
  already set are never overridden.
- It validates them against `src/env/schema.ts` at startup, so a bad value fails `dev`/`build`. The
  `NEXT_PUBLIC_*` schema and the helpers live in `src/env/client-schema.ts`, the only schema module `client.ts`
  may import. `schema.ts` also holds the server schema, whose keys name the secrets.
- Import `serverEnv` from `@/env/server`, which is marked `server-only`, so importing it from a Client Component
  fails the build. Import `clientEnv` from `@/env/client` for `NEXT_PUBLIC_*` vars.
- Never read `process.env` directly.
- To add a variable:
  - Add it to `clientEnvSchema` (`client-schema.ts`) or `serverEnvSchema` (`schema.ts`). A new server secret
    also goes in `SECRET_ENV_VARS` in `scripts/check-client-bundle.mjs`.
  - Add it to the root `.env.example`.
  - Keep it optional in the schema (an empty string counts as unset) until the task that needs it makes it
    required.

## Supabase

Use the wrappers in `src/lib/supabase/`. They read the env and throw a clear error when Supabase isn't
configured. Don't call the `@fanste/supabase` factories directly.

| Where                                         | Use                                       | Key / RLS                |
| --------------------------------------------- | ----------------------------------------- | ------------------------ |
| Client Components                             | `createSupabaseBrowserClient()` (client)  | publishable, RLS applies |
| Server Components, Route Handlers, Server Fns | `await createSupabaseServerClient()`      | publishable, RLS applies |
| Trusted server writes (metadata cache, FC-08) | `createSupabaseServiceClient()` (service) | secret, **bypasses RLS** |

- Create a server client per request; never cache one in module scope.
- The server client can't write cookies from a Server Component. Session refresh is the proxy's job (FC-06).
- `service.ts` is `server-only`. Never serve a user's own data through the service client: RLS is what keeps
  users apart.

## Desktop integration

- `isDesktop()` / `useIsDesktop()` (`src/lib/platform.ts`) detect the Electron preload bridge (`window.fanste`,
  typed as `FansteDesktopBridge` from `@fanste/core`). The hook returns `false` during SSR and hydration, so markup
  always matches. Use the hook in components, not `isDesktop()` during render.
- `<DesktopOnly fallback={…}>` renders its children only in the desktop app.
- Nav items marked `desktopOnly` (the Scanner) are hidden in the browser.
- Call desktop features only through `window.fanste`. To add a bridge method, follow `../desktop/CLAUDE.md`.

## Conventions

- **Next.js 16 differs from training data.** Before writing Next.js code, read the relevant guide in
  `node_modules/next/dist/docs/` (see `AGENTS.md`).
- Typed routes are on: `<Link href>`, `router.push()` and `Route` are checked against real routes.
- shadcn/ui: run `pnpm dlx shadcn@latest add <name>` from this directory; components land in
  `src/components/ui/`. Theme tokens live in `packages/config/tailwind/theme.css` (Tailwind v4, CSS-configured). If
  the CLI writes `:root` or `@theme` tokens into `src/app/globals.css`, move them to the shared theme.
- Put logic that isn't specific to Next.js (types, schemas, parsers) in `packages/*`, not here.
