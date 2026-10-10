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
  - `src/features/` holds feature modules (hooks, components, logic): `auth/`, `profile/` and `collection/`
    so far.
  - Nav entries are defined in `components/app-shell/nav-items.ts`.
- **Data fetching** goes through TanStack Query (`components/providers.tsx`). Defaults: 60 s `staleTime`, and no
  refetch on window focus.
- **Collection data** comes from the `@fanste/collection` hooks (`useCollection`, `useAddItem`, …), never from
  direct Supabase queries. `AppCollectionProvider` (`features/collection/`, in the `(app)` layout) gives them the
  browser Supabase client and the gateway client, turns failed mutations into toasts, and keeps Realtime sync
  running. The collection queries refetch on window focus and reconnect.
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

| Route                                      | Does                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/search?category=&q=&page=&year=` | One page from the category's provider (in-memory LRU in front)                                                                                 |
| `GET /api/items/:provider/:externalId`     | Full `NormalizedItem`, cache-first                                                                                                             |
| `POST /api/items/:provider/:id/refresh`    | Reloads one item from its provider, skipping the TTL (FC-19); rate limited by `REFRESH_LIMITS`                                                 |
| `POST /api/items/batch`                    | Many items: one cache read, only misses go to providers. Refs it can't load come back in `missing` with a reason: `not_found` or `retry_later` |
| `POST /api/match/tmdb`                     | Scanner matching; returns 501 until FC-23                                                                                                      |

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

## Search & add (FC-17)

`/search` is `features/search/`. Its page (Server Component) reads the URL and the user's default currency and
renders `SearchPageClient`.

- The search (`category`, `q`, `year`) lives in the URL. The client updates it with `window.history.replaceState`,
  so typing doesn't make a server round trip. `SEARCHABLE_CATEGORIES` (`search-state.ts`) lists the categories
  whose provider is built; the others show as "Coming soon".
- Results come from `useSearchResults` (an infinite query over `api.search`; busy providers are retried, and
  `failureCount > 0` while fetching shows the "retrying…" banner). `useCollectionCopies` marks results already
  in the collection.
- Quick add (`use-quick-add.ts`) and the "Add with details" dialog both load the full item through
  `providerItemQuery` and prefill with `prefillDetails`. The dialog marks prefilled fields with their source until
  they change. Form → `AddItemInput` conversion is the pure `add-item-form.ts`.
- Recent searches are in `localStorage`, per user (`recent-searches.ts`); the list logic is in `@fanste/core`.
- `SearchShortcut` (in the `(app)` layout) binds Ctrl+K / Cmd+K in the desktop app only.

## Collection gallery (FC-18)

`/collection` is `features/collection/`. Its page (Server Component) reads the URL and renders
`CollectionPageClient`.

- The filters and sort live in the URL (`gallery-state.ts`; list filters repeat a parameter per value,
  e.g. `format=DVD&format=VHS`), written with `window.history.replaceState` like the search page. The
  grid/list choice is in `localStorage`, per user (`view-mode.ts`).
- The database filters, searches, sorts and counts (see `CLAUDE.md` → `@fanste/collection`); the page
  never filters items itself. `useCollectionPages` loads pages of `MAX_BATCH_ITEMS` for infinite scroll,
  so each page's missing metadata is one batch request. `useCollectionFacets` gives the per-value counts.
- `gallery-items.ts` turns a `CollectionItem` into what the cards and rows show (overrides applied,
  `copyBadges`). A custom cover (an `imageUrl` override) renders `unoptimized`; never widen
  `images.remotePatterns` for it.
- `FilterPanel` is the sidebar from `lg` up and a `Sheet` below. `filterOptions` hides values no item has,
  unless selected. Add new detail filters there, in `gallery-state.ts` and in the database function.
- Bulk actions (`SelectionBar`) use `useBulkDeleteItems`, `useBulkUpdateItems` and
  `useTagAssignment().assignMany`. Cards link to the item page, `/collection/[id]` (FC-19).

## Item detail (FC-19)

`/collection/[id]` is `features/item-detail/`. Its page (Server Component) reads the user's default
currency and renders `ItemDetailPageClient`.

- `useCollectionItem` shows the row from a cached gallery page at once, then the database row. The full
  provider item loads in the background through `providerItemQuery` (`features/search/item-query.ts`).
- Every field saves on its own with `useAutosave`: pickers at once, text after a pause or on blur. The
  pure converters in `item-detail-view.ts` (`toCopyPatch`, `toDetailsPatch`, `toOverridesPatch`) turn
  the changed fields into patches of the valid ones plus errors. Copy details and overrides go through the
  FC-15 merge functions.
- The copy-details form pieces (`CopyDetailsFields`, `SeasonPicker`, `OptionField`, `LanguagePicker`,
  `FormField`) and their helpers (`copy-form.ts`) live in `features/copy-form/`, shared with the add
  dialog. The seasons editor adds per-season overrides through `SeasonPicker`'s `renderSeasonExtra`.
- "Edit metadata" writes overrides; an empty value or the provider's own value resets a field. A custom
  cover renders `unoptimized`.
- Delete goes back to the gallery with an "Undo" toast (`useRestoreItem`). "Refresh metadata" calls the
  refresh route (`useRefreshMetadata`) and never touches details or overrides.

## Dashboard (FC-20)

`/dashboard` (the landing page after sign-in) is `features/dashboard/`. Its page (Server Component)
reads the user's default currency and renders `DashboardPageClient`.

- Every number comes from `useCollectionStats` (one `collection_stats()` call, months in the device's
  time zone); Realtime invalidates it like the gallery. Never count items on the client.
- "Items" and the category counts are the copies the user has (`inCollection`: owned, preordered,
  lent); wishlist has its own tile, sold items aren't counted. The value is shown in the default
  currency; totals in other currencies are listed apart, never converted.
- The pure `dashboard-view.ts` shapes the stats for the tiles, category cards (unbuilt categories
  are "Coming soon"), and the two charts, which are plain CSS bars (no chart library).
- "Recently added" is a 12-item `useCollection` page sorted by `added_desc`. An empty collection
  shows `DashboardOnboarding` (search, and in the desktop app the scanner).

## Design system

Tokens are in `packages/config/tailwind/theme.css`. On top of shadcn's colors it has status colors
(`success`/`warning`/`info`), one accent per category (`bg-category-movie`, `text-category-video-game`, …),
a type scale (`text-display`/`title`/`heading`/`caption`), `shadow-card`, `p-page`/`p-card`, `aspect-cover`
(2:3) and a `3xl` breakpoint. Use the tokens, never raw colors, so light and dark mode both work.

- Category and ownership labels, icon names and accents come from `CATEGORY_META` / `OWNERSHIP_META` in
  `@fanste/core`. `components/items/category-style.ts` maps them to Tailwind classes, written out in full
  because Tailwind can't see class names built at runtime.
- Item UI is in `components/items/`: `ItemCard` (takes `ItemCardData`; pass `href` or `onSelect` to make
  it interactive, `badge` and `action` for cover overlays such as a quick-add button), `ItemGrid`
  (window-virtualized, arrow-key navigation), `CoverImage` (blur placeholder, category fallback art),
  `CategoryBadge`, `OwnershipBadge`, `TagChip` and the skeletons. `EmptyState` and `ErrorState` are in
  `components/states/`. Layout math lives in `grid-layout.ts`; keep it in sync with
  the card's padding.
- `/design` (`features/design-system/`) shows every component, plus a 1,000-item grid. It's development
  only (`notFound()` in production) and not in the nav. Add new shared components to it.
- Icon-only buttons need an `aria-label`, and decorative icons get `aria-hidden`. Don't rely on color
  alone (badges pair the color with a label).

## Desktop integration

- `isDesktop()` / `useIsDesktop()` (`src/lib/platform.ts`) detect the Electron preload bridge (`window.fanste`,
  typed as `FansteDesktopBridge` from `@fanste/core`). The hook returns `false` during SSR and hydration, so markup
  always matches. Use the hook in components, not `isDesktop()` during render.
- `<DesktopOnly fallback={…}>` renders its children only in the desktop app.
- Nav items marked `desktopOnly` (the Scanner) are hidden in the browser.
- Call desktop features only through `window.fanste`. To add a bridge method, follow `../desktop/CLAUDE.md`.
- The desktop window has no OS title bar. `DesktopIntegration` (in `providers.tsx`) sets
  `data-desktop-os` on `<html>` and syncs the theme to the window chrome. `globals.css` uses that
  attribute for:
  - the `desktop:`, `desktop-mac:` and `desktop-win:` variants;
  - thin scrollbars;
  - no text selection on chrome (header, nav, buttons, badges).
- A top bar must carry `app-drag` (controls inside stay clickable), `desktop-win:pr-window-controls`
  (room for the Windows controls overlay) and room for the macOS traffic lights in the top-left corner
  (`desktop-mac:pl-20` in the `(auth)` layout; the app shell pushes its sidebar down with
  `desktop-mac:pt-14`). Portaled overlays get `no-drag` from a global rule in `globals.css`; extend its
  selector list for new overlay kinds. A new full-screen layout needs the same, or the window can't
  be moved.

## Conventions

- **Next.js 16 differs from training data.** Before writing Next.js code, read the relevant guide in
  `node_modules/next/dist/docs/` (see `AGENTS.md`).
- Typed routes are on: `<Link href>`, `router.push()` and `Route` are checked against real routes.
- shadcn/ui: run `pnpm dlx shadcn@latest add <name>` from this directory; components land in
  `src/components/ui/`. Theme tokens live in `packages/config/tailwind/theme.css` (Tailwind v4, CSS-configured). If
  the CLI writes `:root` or `@theme` tokens into `src/app/globals.css`, move them to the shared theme.
- Put logic that isn't specific to Next.js (types, schemas, parsers) in `packages/*`, not here.
