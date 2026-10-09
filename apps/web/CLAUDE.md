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
  - `(auth)` holds the signed-out pages (sign-in, sign-up, forgot-password, reset-password).
  - `app/auth/callback` (OAuth PKCE code exchange) and `app/auth/confirm` (email links) are Route Handlers.
  - `(app)` holds the pages inside the sidebar/topbar shell (`components/app-shell`).
  - `src/features/` holds feature modules (hooks, components, logic): `auth/` and `profile/` so far.
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
- The server client can't write cookies from a Server Component. Session refresh is the proxy's job
  (`src/proxy.ts`, via `lib/supabase/proxy.ts`).
- `service.ts` is `server-only`. Never serve a user's own data through the service client: RLS is what keeps
  users apart.

## Authentication

Supabase Auth with cookie sessions (`@supabase/ssr`). Dashboard setup is in README → Authentication setup.

- `src/proxy.ts` (Next.js 16's renamed middleware) runs on every non-static request. It refreshes the session and
  routes by `routeAccess()` in `features/auth/routes.ts`:
  - signed-out users on protected paths go to `/sign-in?next=…`;
  - signed-in users on guest-only pages go to `/dashboard`;
  - `/auth/*`, `/reset-password` and `/api/*` are public. The gateway answers 401 itself (FC-08).
- The proxy is only the first check. Server code gets the user with `getCurrentUser()` / `requireUser()`
  (`features/auth/session.ts`, `server-only`, verified with the Auth server, cached per request). Call one in
  every `(app)` page that loads user data, since the layout's check doesn't cover a page's own payload on
  client-side navigation. Every Server Action checks the user again, because actions can be called directly.
- Redirect targets from the URL (`next`) go through `safeNextPath()`, which blocks open redirects.
- Client Components read the user with `useUser()` / `useSession()` from `features/auth/session-provider.tsx`.
  The provider wraps the `(app)` layout.
- Email/password flows are Server Actions (`features/auth/actions.ts`). The forms use `useActionState` with a
  `FormState`, and the zod schemas come from `@fanste/core`. Show only mapped messages (`authErrorMessage()`),
  never raw Supabase errors.
- Email links go to `/auth/confirm?token_hash=…` (templates in `supabase/templates/`), so they work on any
  device. Google uses PKCE through `/auth/callback`. In the desktop app the Google button opens the provider in
  the system browser (`window.open`), with `redirectTo: fanste://auth/callback` (see `../desktop/CLAUDE.md`).
- Deleting an account is the one user-facing use of the service client: `deleteAccount` takes the user ID from
  the verified session, removes the avatar files, then calls `auth.admin.deleteUser`.
- Avatars are uploaded from the browser to the `avatars` bucket under `<user id>/`. Storage RLS enforces the
  folder. `saveAvatar` only accepts paths in the user's own folder, but that isn't a security boundary: RLS lets
  a user set `profiles.avatar_url` to any `https://` URL directly. Before avatars are shown to other users, add
  a database check on `avatar_url` (allowing the Storage prefix and Google `picture` URLs).

## API gateway

Route Handlers in `src/app/api/*`; the logic lives in `src/server/` (FC-08). The request/response schemas and
the error shape are in `@fanste/core` (`gateway/`), and clients call the gateway through `@fanste/api-client`.

| Route                                      | Does                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `GET /api/search?category=&q=&page=&year=` | One page from the category's provider (in-memory LRU in front) |
| `GET /api/items/:provider/:externalId`     | Full `NormalizedItem`, cache-first                             |
| `POST /api/items/batch`                    | Many items: one cache read, only misses go to providers        |
| `POST /api/match/tmdb`                     | Scanner matching; returns 501 until FC-23                      |

- Every route is wrapped in `gatewayRoute()` (`server/gateway.ts`). It authenticates (session cookies, or
  `Authorization: Bearer <jwt>` for a future mobile app; an invalid bearer is a 401), applies the per-user limit,
  and turns errors into `{ error: { code, message, provider? } }`. Only `GatewayError` messages reach the client.
- Parse input with `parseInput()` and answer with `jsonOk(schema, …)`, so responses match the contract.
- All limits, TTLs and `Cache-Control` values are in `server/limits.ts`. In-memory limits and the search LRU
  are per instance (best effort); `metadata_cache` is the shared cache. Stale rows are served and refreshed
  with `after()`.
- **Adding a provider (FC-10 – FC-12):** implement `ProviderAdapter` (`server/providers/types.ts`), make every
  HTTP call through `providerFetch()` (throttle, retry on 429/503 with `Retry-After`, logging), and register
  the adapter in `server/gateway.ts`. Pass secrets in headers, never in logged URLs. `server/providers/tmdb/`
  is the model to follow: zod schemas for the provider payloads, pure mappers, and the adapter.
- **TMDB (FC-09)** is registered only when `TMDB_API_READ_TOKEN` is set; `TMDB_LANGUAGE` (default `en-US`)
  applies to the whole deployment, because `metadata_cache` isn't keyed by language. `tmdbMatcher` in
  `server/gateway.ts` gives the scanner's matching (FC-23) raw candidates with popularity to score.
- Adapter tests replay recorded responses from `__fixtures__/`, never live calls. Re-record the TMDB ones with
  `pnpm fixtures:tmdb` (needs the token).

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
