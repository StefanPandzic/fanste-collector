-- Initial schema (FC-05): the universal collection schema with polymorphic external IDs.
--
-- The database is an index, not a media host. It stores provider + external ID and each user's own
-- data, plus a small shared metadata cache. Provider data (`metadata_cache`) and user-entered data
-- (`details`, `metadata_overrides`) are kept apart, so a metadata refresh never overwrites what a user
-- typed (FC-15).
--
-- Access: every user table has RLS scoped to `auth.uid()`. `anon` gets no privileges at all.
-- `metadata_cache` is read-only for signed-in users and written only by the API gateway through the
-- service role (FC-08). Grants are explicit, so they don't depend on the project's auto-expose setting.

-- ---------------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------------

-- `tv` is split from `movie` because TMDB uses separate endpoints and ID spaces for them.
create type public.item_category as enum ('movie', 'tv', 'music', 'video_game', 'board_game', 'funko');
create type public.metadata_provider as enum ('tmdb', 'discogs', 'igdb', 'bgg', 'custom');
create type public.ownership_status as enum ('owned', 'wishlist', 'preordered', 'loaned_out', 'sold');

-- ---------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------

-- One row per user, created by `handle_new_user()` when the auth user signs up.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text not null default 'EUR' check (default_currency ~ '^[A-Z]{3}$'),
  -- e.g. the last-used format/details per category (FC-15)
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now()
);

-- Shared cache of lightweight provider metadata, one row per external entity. Keep `payload` small (no
-- full API responses): the free tier has 500 MB. Custom items are never cached.
create table public.metadata_cache (
  provider public.metadata_provider not null check (provider <> 'custom'),
  external_id text not null, -- text, so any provider's ID format fits
  category public.item_category not null,
  title text not null,
  subtitle text, -- artist, platform, series, ...
  release_year int,
  image_url text,
  payload jsonb, -- normalized extra fields
  fetched_at timestamptz not null default now(),
  primary key (provider, external_id),
  constraint metadata_cache_provider_category check (
    (provider = 'tmdb' and category in ('movie', 'tv'))
    or (provider = 'discogs' and category = 'music')
    or (provider = 'igdb' and category = 'video_game')
    or (provider = 'bgg' and category = 'board_game')
  )
);

-- The user's collection. One row per copy: the same title in two formats (DVD and 4K) is two rows.
create table public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category public.item_category not null,
  provider public.metadata_provider not null,
  external_id text, -- null for custom items
  -- Title/image/etc. of custom (Funko) items. Keys are camelCase like the normalized item (FC-07):
  -- `title`, `subtitle`, `releaseYear`, `imageUrl`, ... (FC-13).
  custom_data jsonb,
  format text, -- medium: 'DVD', 'Blu-ray', '4K UHD Blu-ray', 'Vinyl', 'CD', 'Disc', 'Cartridge', 'Digital', ...
  -- Only for the uniqueness check below: a missing format counts as a format of its own.
  format_key text not null generated always as (coalesce(format, '')) stored,
  details jsonb not null default '{}', -- the user's copy: resolution, storefront, disc count, edition, ... (FC-15)
  -- User corrections of API fields, camelCase like the normalized item: `title`, `subtitle`,
  -- `releaseYear`, `imageUrl`, ... (FC-15)
  metadata_overrides jsonb not null default '{}',
  ownership public.ownership_status not null default 'owned',
  quantity int not null default 1 check (quantity >= 1),
  acquired_at date,
  purchase_price numeric(12, 2) check (purchase_price >= 0),
  estimated_value numeric(12, 2) check (estimated_value >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'search', 'scanner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collection_items_external_id_required check (provider = 'custom' or external_id is not null),
  constraint collection_items_custom_data_required check (provider <> 'custom' or custom_data is not null),
  constraint collection_items_provider_category check (
    provider = 'custom'
    or (provider = 'tmdb' and category in ('movie', 'tv'))
    or (provider = 'discogs' and category = 'music')
    or (provider = 'igdb' and category = 'video_game')
    or (provider = 'bgg' and category = 'board_game')
  ),
  -- One row per user, external item and format. Custom items have no external ID, and NULLs are
  -- distinct, so they never collide. A plain constraint (not a partial index), so PostgREST upserts can
  -- target it (`onConflict: 'user_id,provider,external_id,format_key'`, FC-23).
  constraint collection_items_unique_copy unique (user_id, provider, external_id, format_key),
  -- Target of the composite foreign keys that keep tag links and scanned files within one user.
  constraint collection_items_id_user_id_key unique (id, user_id)
);

create index collection_items_user_id_category_idx on public.collection_items (user_id, category);
create index collection_items_user_id_created_at_idx on public.collection_items (user_id, created_at desc);
create index collection_items_provider_external_id_idx on public.collection_items (provider, external_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  color text,
  unique (user_id, name),
  constraint tags_id_user_id_key unique (id, user_id)
);

-- `user_id` is part of both foreign keys, so a link can only join a user's own item to their own tag.
-- It also keeps the RLS check simple and lets Realtime subscriptions filter by user (FC-14).
create table public.collection_item_tags (
  item_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (item_id, tag_id),
  foreign key (item_id, user_id) references public.collection_items (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

create index collection_item_tags_tag_id_idx on public.collection_item_tags (tag_id);
create index collection_item_tags_user_id_idx on public.collection_item_tags (user_id);

-- Desktop scanner state (FC-21..FC-24), one row per file per device.
create table public.scanned_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  device_id text not null,
  file_path text not null,
  file_size bigint,
  file_modified_at timestamptz, -- with `file_size`, lets a re-scan skip unchanged files (FC-21)
  parsed_title text,
  parsed_year int,
  parsed_format text,
  match_status text not null default 'pending'
    check (match_status in ('pending', 'matched', 'unmatched', 'ignored', 'manual')),
  match_confidence real check (match_confidence between 0 and 1),
  collection_item_id uuid,
  scanned_at timestamptz not null default now(),
  removed_at timestamptz, -- set when a re-scan no longer finds the file (FC-21)
  unique (user_id, device_id, file_path),
  -- Only the item column is cleared when the item is deleted; `user_id` stays.
  foreign key (collection_item_id, user_id) references public.collection_items (id, user_id)
    on delete set null (collection_item_id)
);

create index scanned_files_collection_item_id_idx on public.scanned_files (collection_item_id);

-- ---------------------------------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger collection_items_set_updated_at
before update on public.collection_items
for each row execute function public.set_updated_at();

-- Creates the profile of a new auth user. Google sign-in (FC-06) fills `full_name`/`name` and
-- `avatar_url`/`picture` in the user metadata. `security definer`, because the auth service inserts
-- the user and has no privileges on `public.profiles`.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Trigger functions only: nobody calls them through the API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Users who signed up before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- Gallery view
-- ---------------------------------------------------------------------------------------------------

-- Items with their display values: metadata overrides first, then the cached provider metadata, then
-- the custom item's own data. The raw provider values are returned too, for "reset to original"
-- (FC-15). `security_invoker`, so the RLS of the underlying tables applies to the caller.
create view public.collection_items_view
with (security_invoker = true)
as
select
  ci.id,
  ci.user_id,
  ci.category,
  ci.provider,
  ci.external_id,
  ci.custom_data,
  ci.format,
  ci.details,
  ci.metadata_overrides,
  ci.ownership,
  ci.quantity,
  ci.acquired_at,
  ci.purchase_price,
  ci.estimated_value,
  ci.currency,
  ci.notes,
  ci.source,
  ci.created_at,
  ci.updated_at,
  coalesce(
    nullif(ci.metadata_overrides ->> 'title', ''),
    mc.title,
    nullif(ci.custom_data ->> 'title', '')
  ) as title,
  coalesce(
    nullif(ci.metadata_overrides ->> 'subtitle', ''),
    mc.subtitle,
    nullif(ci.custom_data ->> 'subtitle', '')
  ) as subtitle,
  -- Only well-formed years are cast, so one bad value can't make the whole query fail.
  coalesce(
    case
      when ci.metadata_overrides ->> 'releaseYear' ~ '^[0-9]{1,4}$'
        then (ci.metadata_overrides ->> 'releaseYear')::int
    end,
    mc.release_year,
    case
      when ci.custom_data ->> 'releaseYear' ~ '^[0-9]{1,4}$'
        then (ci.custom_data ->> 'releaseYear')::int
    end
  ) as release_year,
  coalesce(
    nullif(ci.metadata_overrides ->> 'imageUrl', ''),
    mc.image_url,
    nullif(ci.custom_data ->> 'imageUrl', '')
  ) as image_url,
  mc.title as provider_title,
  mc.subtitle as provider_subtitle,
  mc.release_year as provider_release_year,
  mc.image_url as provider_image_url,
  mc.fetched_at as metadata_fetched_at -- null: not cached yet, fetch via the gateway (FC-14)
from public.collection_items ci
left join public.metadata_cache mc
  on mc.provider = ci.provider and mc.external_id = ci.external_id;

-- ---------------------------------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.metadata_cache,
  public.collection_items,
  public.tags,
  public.collection_item_tags,
  public.scanned_files,
  public.collection_items_view
from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.metadata_cache to authenticated;
grant select, insert, update, delete on table
  public.collection_items,
  public.tags,
  public.scanned_files
to authenticated;
grant select, insert, delete on table public.collection_item_tags to authenticated;
grant select on table public.collection_items_view to authenticated;

grant all on table
  public.profiles,
  public.metadata_cache,
  public.collection_items,
  public.tags,
  public.collection_item_tags,
  public.scanned_files,
  public.collection_items_view
to service_role;

alter table public.profiles enable row level security;
alter table public.metadata_cache enable row level security;
alter table public.collection_items enable row level security;
alter table public.tags enable row level security;
alter table public.collection_item_tags enable row level security;
alter table public.scanned_files enable row level security;

-- profiles: a user reads and edits only their own profile. It is deleted with the auth user.
create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- metadata_cache: readable by every signed-in user. No write policies: only the service role
-- (which bypasses RLS) writes it.
create policy "Signed-in users can read the metadata cache"
on public.metadata_cache for select to authenticated
using (true);

-- collection_items
create policy "Users can read their own items"
on public.collection_items for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can add their own items"
on public.collection_items for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own items"
on public.collection_items for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own items"
on public.collection_items for delete to authenticated
using (user_id = (select auth.uid()));

-- tags
create policy "Users can read their own tags"
on public.tags for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can add their own tags"
on public.tags for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own tags"
on public.tags for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own tags"
on public.tags for delete to authenticated
using (user_id = (select auth.uid()));

-- collection_item_tags: key columns only, so there is nothing to update.
create policy "Users can read their own tag links"
on public.collection_item_tags for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can add their own tag links"
on public.collection_item_tags for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can delete their own tag links"
on public.collection_item_tags for delete to authenticated
using (user_id = (select auth.uid()));

-- scanned_files
create policy "Users can read their own scanned files"
on public.scanned_files for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can add their own scanned files"
on public.scanned_files for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own scanned files"
on public.scanned_files for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own scanned files"
on public.scanned_files for delete to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------------------------------

-- Instant sync between the browser and the desktop app (FC-14). Replaced by per-user Broadcast in
-- 20260925151119_user_realtime_and_id_formats.sql: Postgres Changes doesn't apply RLS to DELETE events.
alter publication supabase_realtime add table public.collection_items, public.collection_item_tags;
