# FC-08 — API gateway, rate limiting & caching

**Phase:** 2 — API & Data Modeling · **Depends on:** FC-02, FC-05, FC-07 · **Platforms:** backend (Next.js Route Handlers)

## Goal
Provide a single server-side gateway in `apps/web/src/app/api/*` that the web app and the desktop app call for
external metadata. It hides API keys, applies per-provider rate limits, and caches metadata in Supabase so
that we don't get rate-limited or IP-blocked (SRS §4.1).

## Endpoints
| Method | Route | Description |
|---|---|---|
| GET | `/api/search?category=&q=&page=` | Search one category's provider |
| GET | `/api/items/:provider/:externalId` | Full normalized details (cache-first) |
| POST | `/api/items/batch` | `{ items: [{provider, externalId}] }` → cached metadata for many items at once |
| POST | `/api/match/tmdb` | Scanner matching `{ title, year, kind }` → best candidates + confidence (FC-23) |

## Subtasks
- [x] Provider adapter interface in `apps/web/src/server/providers/types.ts`:
  ```ts
  interface ProviderAdapter {
    provider: MetadataProvider;
    categories: ItemCategory[];
    search(q: string, opts: { category: ItemCategory; page: number }): Promise<SearchResponse>;
    getById(externalId: string, category: ItemCategory): Promise<NormalizedItem>;
  }
  ```
- [x] Provider registry mapping category → adapter
- [x] Auth guard: every route requires a valid Supabase session (cookie-based; also accept `Authorization: Bearer <jwt>` so a future mobile app can reuse the gateway)
- [x] Rate limiting:
  - [x] Outbound per-provider throttle/queue (`p-limit` / token bucket) with provider limits configured in one place
  - [x] Retry with exponential backoff on HTTP 429/503, honour `Retry-After`
  - [x] Inbound per-user limit (e.g. 60 req/min) to protect our own quota
- [x] Caching:
  - [x] Read-through cache on `metadata_cache` (service role client), TTL per provider (e.g. 30 days, refresh in background when stale)
  - [x] Upsert into `metadata_cache` when an item is added to a collection or fetched by ID
  - [x] Short-lived in-memory LRU for search results (per instance)
  - [x] `batch` endpoint served entirely from cache when possible; fetch only misses, throttled
  - [x] HTTP `Cache-Control` headers on search/detail responses
- [x] Consistent error shape `{ error: { code, message, provider? } }` with zod-validated responses
- [x] `packages/api-client`: typed fetch client (`search`, `getItem`, `getItemsBatch`, `matchTmdb`) that takes a base URL + token provider — used by the web UI and the desktop scanner
- [x] Logging of provider latency / errors (console in v1)

## Acceptance criteria
- Clients never call a third-party API directly and no provider secret is present in any client bundle.
- Loading a gallery of 50 items triggers at most one batch request and zero provider calls when metadata is cached.
- Simulated 429s are retried with backoff and do not crash the request.
- Unauthenticated requests get `401`.

## Notes
- Serverless instances don't share memory, so the Supabase `metadata_cache` is the primary cache; in-memory limiters are best-effort per instance. If needed later, add Upstash Redis for a global limiter.
- The cache is filled when an item is fetched by ID (`getItem`, batch misses). Adding an item to a collection
  (FC-14 `addItem`) calls `GET /api/items/:provider/:externalId` first, which upserts it.
- `POST /api/match/tmdb` takes a batch (`{ queries: [...] }`, up to 20, as FC-23 needs); its contract and client
  method exist, and it answers 501 until FC-23 adds the TMDB scoring.
