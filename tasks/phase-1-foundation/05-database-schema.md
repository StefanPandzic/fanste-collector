# FC-05 — Database schema & Row Level Security

**Phase:** 1 — Foundation · **Depends on:** FC-04 · **Platforms:** backend

## Goal
Build the universal schema that handles **polymorphic external IDs** (SRS §5 Phase 1). The database is an index, not a
media host: it stores provider + external ID and user-specific state, plus a small shared metadata cache (SRS §4.1).

## Proposed schema

```sql
-- enums
create type item_category as enum ('movie', 'tv', 'music', 'video_game', 'board_game', 'funko');
create type metadata_provider as enum ('tmdb', 'discogs', 'igdb', 'bgg', 'custom');
create type ownership_status as enum ('owned', 'wishlist', 'preordered', 'loaned_out', 'sold');

-- one row per user
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text not null default 'EUR',
  preferences jsonb not null default '{}', -- e.g. last-used format/details per category (FC-15)
  created_at timestamptz not null default now()
);

-- shared cache of lightweight metadata, one row per external entity
create table metadata_cache (
  provider metadata_provider not null,
  external_id text not null,          -- text so any provider's ID format fits
  category item_category not null,
  title text not null,
  subtitle text,                      -- artist, platform, series, ...
  release_year int,
  image_url text,
  payload jsonb,                      -- normalized extra fields
  fetched_at timestamptz not null default now(),
  primary key (provider, external_id)
);

-- the user's collection
create table collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category item_category not null,
  provider metadata_provider not null,
  external_id text,                   -- null for custom items
  custom_data jsonb,                  -- title/image/etc. for custom (Funko) items
  format text,                        -- medium: 'DVD', 'Blu-ray', '4K UHD Blu-ray', 'Vinyl', 'CD', 'Disc', 'Cartridge', 'Digital', ...
  details jsonb not null default '{}',            -- user's copy details: resolution, storefront, disc count, edition, ... (FC-15)
  metadata_overrides jsonb not null default '{}', -- user corrections of API fields: title, year, cover, ... (FC-15)
  ownership ownership_status not null default 'owned',
  quantity int not null default 1,
  acquired_at date,
  purchase_price numeric(12,2),
  estimated_value numeric(12,2),
  currency text,
  notes text,
  source text not null default 'manual', -- 'manual' | 'search' | 'scanner'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text,
  unique (user_id, name)
);

create table collection_item_tags (
  item_id uuid references collection_items on delete cascade,
  tag_id uuid references tags on delete cascade,
  primary key (item_id, tag_id)
);

-- desktop scanner state (FC-21..FC-24)
create table scanned_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  device_id text not null,
  file_path text not null,
  file_size bigint,
  parsed_title text,
  parsed_year int,
  parsed_format text,
  match_status text not null default 'pending', -- pending | matched | unmatched | ignored | manual
  match_confidence real,
  collection_item_id uuid references collection_items on delete set null,
  scanned_at timestamptz not null default now(),
  unique (user_id, device_id, file_path)
);
```

## Subtasks
- [x] Write migration(s) for the tables and enums above (adjust after review) — `supabase/migrations/20260925140232_initial_schema.sql` + review fixes in `20260925151119_user_realtime_and_id_formats.sql`; adjustments: `user_id default auth.uid()` everywhere, `collection_item_tags.user_id` with composite FKs, `scanned_files.file_modified_at` / `removed_at` (FC-21), check constraints for `source`, `match_status`, amounts, currency, provider ↔ category and the external ID format per provider (TMDB `movie:603` / `tv:1396`, since movie and TV IDs overlap)
- [x] Constraints:
  - [x] `check (provider = 'custom' or external_id is not null)`
  - [x] `check (provider <> 'custom' or custom_data is not null)`
  - [x] Decide on duplicates: allow the same external item multiple times (different formats) — unique on `(user_id, provider, external_id, format)` (via the generated `format_key = lower(btrim(coalesce(format, '')))`, so a missing format also counts and case/spaces don't; a plain constraint, so upserts can target it)
- [x] Indexes: `collection_items(user_id, category)`, `(user_id, created_at desc)`, `(provider, external_id)`
- [x] `updated_at` trigger
- [x] Trigger to create a `profiles` row on new `auth.users` insert (existing users are backfilled)
- [x] RLS:
  - [x] `profiles`, `collection_items`, `tags`, `collection_item_tags`, `scanned_files`: user can only CRUD own rows (profiles: no delete, they go with the auth user; tag links: no update)
  - [x] `metadata_cache`: `select` for authenticated users; writes only via service role (gateway)
- [x] View `collection_items_view` joining items with `metadata_cache` (title, image, year) for fast gallery queries, with `metadata_overrides` applied on top (details in FC-15) — `security_invoker`, also returns the raw `provider_*` values
- [x] Enable Realtime on `collection_items` and `collection_item_tags` — as per-user private Broadcast (`user:<uid>`, triggers + a `realtime.messages` policy), not Postgres Changes, which doesn't apply RLS to DELETE events
- [x] Scanned files whose item is deleted go back to `unmatched` (trigger), for Fix Match (FC-24)
- [x] Regenerate types (`pnpm db:types`)
- [x] RLS integration tests (Vitest) against the dev Supabase Cloud project ~~using the two test users~~ with two throwaway users per run: user A cannot read/write user B's rows, anon cannot read anything — `pnpm test:rls`, run in the `DB drift` workflow

## Acceptance criteria
- Migrations apply cleanly to the dev Supabase Cloud project with `supabase db push`.
- RLS tests pass; anonymous users cannot read any collection data.
- Generated TS types are committed and used by `@fanste/supabase`.

## Notes
- `tv` is split from `movie` because TMDB uses separate endpoints and ID spaces for them.
- Keep `metadata_cache.payload` small (no full API responses) to respect the 500 MB free tier.
- API data (`metadata_cache`) and user-entered data (`details`, `metadata_overrides`) are kept separate on purpose, so refreshing metadata from a provider never overwrites what the user typed (FC-15).
