-- Custom collections (FC-13).
--
-- Besides the integrated categories, a user creates their own collections (Funko Pops, LEGO, coins,
-- ...). Collections are rows, not categories: every custom item has `category = 'custom'`,
-- `provider = 'custom'` and points at one of the user's `custom_collections`. Its title, number, year,
-- maker, description and photo are in `custom_data` (`customItemDataSchema` in `@fanste/core`).
--
-- 1. `funko` becomes `custom`. No rows used it.
-- 2. `custom_collections`: name, icon, description and order; at most 50 per user; RLS for the owner;
--    changes are broadcast on `user:<id>` like the items.
-- 3. `collection_items.custom_collection_id`, with a composite foreign key that keeps items and
--    collections within one user and deletes a collection's items with it.
-- 4. The view returns the column, and the one filter implementation gets flag 19
--    (`customCollectionIds[]`) and a `customCollection` facet. The argument list changes, so the
--    helpers are created with the new signature and the old ones dropped, as in
--    `20261012123103_music_country_filter`. Keep them inlinable (no `set search_path` on the helpers,
--    no subqueries, scalar arguments).
-- 5. `collection_stats` counts per custom collection too, for the dashboard.
-- 6. Storage bucket `custom-images` for item photos and uploaded covers.

-- ---------------------------------------------------------------------------------------------------
-- 1. Category
-- ---------------------------------------------------------------------------------------------------

alter type public.item_category rename value 'funko' to 'custom';

-- ---------------------------------------------------------------------------------------------------
-- 2. Collections
-- ---------------------------------------------------------------------------------------------------

-- `icon` is a Lucide icon name from `CUSTOM_COLLECTION_ICONS` in `@fanste/core`; keep the lists equal.
create table public.custom_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 50 and name = btrim(name)),
  description text check (char_length(description) <= 500),
  icon text not null default 'shapes' check (
    icon in (
      'shapes', 'toy-brick', 'blocks', 'book-open', 'library', 'coins', 'gem', 'stamp',
      'footprints', 'shirt', 'watch', 'glasses', 'car-front', 'plane', 'train-front', 'trophy',
      'medal', 'camera', 'palette', 'guitar', 'puzzle', 'swords', 'wine', 'leaf', 'star', 'heart',
      'package', 'box'
    )
  ),
  -- Position in the user's list, smallest first. Set on insert (last), changed by
  -- `reorder_custom_collections`.
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Target of the composite foreign key of `collection_items`.
  constraint custom_collections_id_user_id_key unique (id, user_id)
);

-- Names are unique per user, ignoring case.
create unique index custom_collections_user_id_name_key
  on public.custom_collections (user_id, lower(name));

create trigger custom_collections_set_updated_at
before update on public.custom_collections
for each row execute function public.set_updated_at();

-- Puts a new collection at the end of the user's list and enforces the limit of 50
-- (`MAX_CUSTOM_COLLECTIONS`). The advisory lock serializes a user's concurrent inserts, so two of
-- them can't both pass the count. `program_limit_exceeded` tells the client which limit failed.
create function public.custom_collections_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
  v_last int;
begin
  perform pg_advisory_xact_lock(hashtextextended('custom_collections:' || new.user_id::text, 0));
  select count(*), max(sort_order) into v_count, v_last
  from public.custom_collections
  where user_id = new.user_id;
  if v_count >= 50 then
    raise exception 'A user can have at most 50 custom collections.'
      using errcode = 'program_limit_exceeded';
  end if;
  new.sort_order := coalesce(v_last + 1, 0);
  return new;
end;
$$;

revoke execute on function public.custom_collections_before_insert()
  from public, anon, authenticated;

create trigger custom_collections_before_insert
before insert on public.custom_collections
for each row execute function public.custom_collections_before_insert();

-- New or renamed collections appear in the user's other open clients (FC-14).
create trigger custom_collections_broadcast
after insert or update or delete on public.custom_collections
for each row execute function public.broadcast_user_change();

revoke all on table public.custom_collections from anon, authenticated;
grant select, insert, update, delete on table public.custom_collections to authenticated;
grant all on table public.custom_collections to service_role;

alter table public.custom_collections enable row level security;

create policy "Users can read their own custom collections"
on public.custom_collections for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can add their own custom collections"
on public.custom_collections for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own custom collections"
on public.custom_collections for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their own custom collections"
on public.custom_collections for delete to authenticated
using (user_id = (select auth.uid()));

-- Sets the order of the caller's collections: `p_ids[1]` first. Collections left out keep their
-- position number. `security invoker`, so RLS limits it to the caller's rows.
create function public.reorder_custom_collections(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.custom_collections c
  set sort_order = o.position - 1
  from unnest(p_ids) with ordinality as o(id, position)
  where c.id = o.id and c.user_id = (select auth.uid());
$$;

revoke execute on function public.reorder_custom_collections(uuid[]) from public, anon;
grant execute on function public.reorder_custom_collections(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 3. Items
-- ---------------------------------------------------------------------------------------------------

-- `user_id` is part of the foreign key, so an item can only point at its owner's collection.
-- Deleting a collection deletes its items (the UI confirms with their count first).
alter table public.collection_items
  add column custom_collection_id uuid,
  add constraint collection_items_custom_collection_fkey
    foreign key (custom_collection_id, user_id)
    references public.custom_collections (id, user_id) on delete cascade,
  -- Exactly the `custom` items belong to a collection. Manual items of an integrated category
  -- ("Can't find it? Add manually", e.g. a `movie` with `provider = 'custom'`) have none.
  add constraint collection_items_custom_collection_required
    check ((category = 'custom') = (custom_collection_id is not null)),
  -- `collection_items_provider_category` already lets `provider = 'custom'` hold any category; this
  -- is the other direction: a `custom` item never has a metadata provider.
  add constraint collection_items_custom_provider
    check (category <> 'custom' or provider = 'custom');

create index collection_items_custom_collection_id_idx
  on public.collection_items (custom_collection_id)
  where custom_collection_id is not null;

-- ---------------------------------------------------------------------------------------------------
-- 4. View and filters
-- ---------------------------------------------------------------------------------------------------

-- `create or replace` keeps the grants and may only append columns, so the existing ones are repeated
-- unchanged (from `20261009191839_collection_data_layer`) and `custom_collection_id` comes last.
create or replace view public.collection_items_view
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
  mc.fetched_at as metadata_fetched_at, -- null: not cached yet, fetch via the gateway (FC-14)
  mc.payload as metadata_payload,
  ci.custom_collection_id
from public.collection_items ci
left join public.metadata_cache mc
  on mc.provider = ci.provider and mc.external_id = ci.external_id;

-- Whether an item passes each filter, as an array of 19 flags in this order: 1 `category`,
-- 2 `ownership[]`, 3 `formats[]` (a TV season's medium counts too), 4 `sources[]`, 5 `tagIds[]`,
-- 6 `acquiredFrom` / `acquiredTo` (inclusive dates), 7 `search` (title or subtitle, literal), and the
-- `details` filters 8 `resolution[]`, 9 `hdr[]`, 10 `edition[]`, 11 `audioLanguages[]`,
-- 12 `subtitleLanguages[]`, 13 `vinylSize[]`, 14 `mediaCondition[]`, 15 `sleeveCondition[]`,
-- 16 `countries[]` (a record's release country, FC-10), 17 `platform[]` and 18 `storefront[]` (a
-- game's, FC-11), and 19 `customCollectionIds[]` (FC-13). A filter that is off passes. Within a
-- filter, any of its values matches. The arguments are the item's columns in
-- `collection_items_view`, its tag IDs and its release country (`metadata_payload.extra.country`).
create function public.collection_item_filter_flags(
  p_category public.item_category,
  p_ownership public.ownership_status,
  p_format text,
  p_source text,
  p_acquired_at date,
  p_title text,
  p_subtitle text,
  p_details jsonb,
  p_tag_ids uuid[],
  p_country text,
  p_custom_collection_id uuid,
  p_filter jsonb
)
returns boolean[]
language sql
stable
as $$
  select array[
    p_filter ->> 'category' is null or coalesce(p_category::text = p_filter ->> 'category', false),
    public.collection_filter_off(p_filter -> 'ownership')
      or coalesce((p_filter -> 'ownership') ? p_ownership::text, false),
    public.collection_filter_off(p_filter -> 'formats')
      or coalesce((p_filter -> 'formats') ? p_format, false)
      or coalesce(public.collection_details_match(p_details, 'format', p_filter -> 'formats'), false),
    public.collection_filter_off(p_filter -> 'sources')
      or coalesce((p_filter -> 'sources') ? p_source, false),
    public.collection_filter_off(p_filter -> 'tagIds')
      or coalesce((p_filter -> 'tagIds') ?| p_tag_ids::text[], false),
    (
      p_filter ->> 'acquiredFrom' is null
      or coalesce(p_acquired_at >= (p_filter ->> 'acquiredFrom')::date, false)
    ) and (
      p_filter ->> 'acquiredTo' is null
      or coalesce(p_acquired_at <= (p_filter ->> 'acquiredTo')::date, false)
    ),
    coalesce(p_filter ->> 'search', '') = ''
      or coalesce(
        p_title ilike '%' || public.collection_escape_like(p_filter ->> 'search') || '%',
        false
      )
      or coalesce(
        p_subtitle ilike '%' || public.collection_escape_like(p_filter ->> 'search') || '%',
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'resolution')
      or coalesce(
        public.collection_details_match(
          p_details, 'resolution', p_filter -> 'details' -> 'resolution'
        ),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'hdr')
      or coalesce(
        public.collection_details_match(p_details, 'hdr', p_filter -> 'details' -> 'hdr'),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'edition')
      or coalesce(
        public.collection_details_match(p_details, 'edition', p_filter -> 'details' -> 'edition'),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'audioLanguages')
      or coalesce(
        public.collection_details_match(
          p_details, 'audioLanguages[*]', p_filter -> 'details' -> 'audioLanguages'
        ),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'subtitleLanguages')
      or coalesce(
        public.collection_details_match(
          p_details, 'subtitleLanguages[*]', p_filter -> 'details' -> 'subtitleLanguages'
        ),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'vinylSize')
      or coalesce(
        public.collection_details_match(
          p_details, 'vinylSize', p_filter -> 'details' -> 'vinylSize'
        ),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'mediaCondition')
      or coalesce(
        public.collection_details_match(
          p_details, 'mediaCondition', p_filter -> 'details' -> 'mediaCondition'
        ),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'sleeveCondition')
      or coalesce(
        public.collection_details_match(
          p_details, 'sleeveCondition', p_filter -> 'details' -> 'sleeveCondition'
        ),
        false
      ),
    public.collection_filter_off(p_filter -> 'countries')
      or coalesce((p_filter -> 'countries') ? p_country, false),
    public.collection_filter_off(p_filter -> 'details' -> 'platform')
      or coalesce(
        public.collection_details_match(p_details, 'platform', p_filter -> 'details' -> 'platform'),
        false
      ),
    public.collection_filter_off(p_filter -> 'details' -> 'storefront')
      or coalesce(
        public.collection_details_match(
          p_details, 'storefront', p_filter -> 'details' -> 'storefront'
        ),
        false
      ),
    public.collection_filter_off(p_filter -> 'customCollectionIds')
      or coalesce((p_filter -> 'customCollectionIds') ? p_custom_collection_id::text, false)
  ]
$$;

-- Whether an item passes every filter (see `collection_item_filter_flags`).
create function public.collection_item_matches(
  p_category public.item_category,
  p_ownership public.ownership_status,
  p_format text,
  p_source text,
  p_acquired_at date,
  p_title text,
  p_subtitle text,
  p_details jsonb,
  p_tag_ids uuid[],
  p_country text,
  p_custom_collection_id uuid,
  p_filter jsonb
)
returns boolean
language sql
stable
as $$
  select not (
    false = any(
      public.collection_item_filter_flags(
        p_category, p_ownership, p_format, p_source, p_acquired_at, p_title, p_subtitle,
        p_details, p_tag_ids, p_country, p_custom_collection_id, p_filter
      )
    )
  )
$$;

-- `create or replace` keeps the grants; without a `set` clause the old `search_path` setting goes.
create or replace function public.collection_items_filtered(p_filter jsonb default '{}'::jsonb)
returns setof public.collection_items_view
language sql
stable
security invoker
as $$
  select v.*
  from public.collection_items_view v
  cross join lateral (
    select coalesce(array_agg(t.tag_id), '{}') as ids
    from public.collection_item_tags t
    where t.item_id = v.id
  ) tags
  where v.user_id = (select auth.uid())
    and public.collection_item_matches(
      v.category, v.ownership, v.format, v.source, v.acquired_at, v.title, v.subtitle, v.details,
      tags.ids, v.metadata_payload -> 'extra' ->> 'country', v.custom_collection_id, p_filter
    );
$$;

-- One row per facet and value: how many of the caller's items (copies) pass every filter but the
-- facet's own and have the value. A TV copy counts once per value, even when the show and several of
-- its seasons have it.
create or replace function public.collection_facets(p_filter jsonb default '{}'::jsonb)
returns table (facet text, value text, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with flagged as materialized (
    select
      v.id, v.category, v.ownership, v.format, v.source, v.details, tags.ids as tag_ids,
      v.metadata_payload -> 'extra' ->> 'country' as country,
      v.custom_collection_id,
      public.collection_item_filter_flags(
        v.category, v.ownership, v.format, v.source, v.acquired_at, v.title, v.subtitle, v.details,
        tags.ids, v.metadata_payload -> 'extra' ->> 'country', v.custom_collection_id, p_filter
      ) as flags
    from public.collection_items_view v
    cross join lateral (
      select coalesce(array_agg(t.tag_id), '{}') as ids
      from public.collection_item_tags t
      where t.item_id = v.id
    ) tags
    where v.user_id = (select auth.uid())
  ),
  -- Items that fail at most one filter: the only ones any facet can count.
  items as (
    select f.*, cardinality(array_positions(f.flags, false)) as failed
    from flagged f
    where cardinality(array_positions(f.flags, false)) <= 1
  ),
  -- Per facet: its flag in `collection_item_filter_flags` and its JSON path in `details`.
  facets (facet, flag, path) as (
    values
      ('category', 1, null),
      ('ownership', 2, null),
      ('format', 3, null),
      ('source', 4, null),
      ('tag', 5, null),
      ('resolution', 8, 'resolution'),
      ('hdr', 9, 'hdr'),
      ('edition', 10, 'edition'),
      ('audioLanguage', 11, 'audioLanguages[*]'),
      ('subtitleLanguage', 12, 'subtitleLanguages[*]'),
      ('vinylSize', 13, 'vinylSize'),
      ('mediaCondition', 14, 'mediaCondition'),
      ('sleeveCondition', 15, 'sleeveCondition'),
      ('country', 16, null),
      ('platform', 17, 'platform'),
      ('storefront', 18, 'storefront'),
      ('customCollection', 19, null)
  ),
  facet_values as (
    select f.facet, i.id, v.value
    from facets f
    join items i on i.failed = 0 or not i.flags[f.flag]
    cross join lateral (
      -- The values the item has for this facet (deduplicated per item by `union`). The path queries
      -- are evaluated for every facet, so a facet without a path reads a key that never exists.
      select i.category::text where f.facet = 'category'
      union
      select i.ownership::text where f.facet = 'ownership'
      union
      select i.source where f.facet = 'source'
      union
      select unnest(i.tag_ids)::text where f.facet = 'tag'
      union
      select i.format where f.facet = 'format'
      union
      select i.country where f.facet = 'country'
      union
      select i.custom_collection_id::text where f.facet = 'customCollection'
      union
      select s #>> '{}'
      from jsonb_path_query(i.details, 'lax $.seasons[*].format') s
      where f.facet = 'format' and jsonb_typeof(s) = 'string'
      union
      select s #>> '{}'
      from jsonb_path_query(i.details, ('lax $.' || coalesce(f.path, 'none'))::jsonpath) s
      where f.path is not null and jsonb_typeof(s) = 'string'
      union
      select s #>> '{}'
      from jsonb_path_query(
        i.details, ('lax $.seasons[*].' || coalesce(f.path, 'none'))::jsonpath
      ) s
      where f.path is not null and jsonb_typeof(s) = 'string'
    ) v(value)
  )
  select facet, value, count(*) as item_count
  from facet_values
  where value is not null
  group by facet, value;
$$;

drop function public.collection_item_matches(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], text,
  jsonb
);
drop function public.collection_item_filter_flags(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], text,
  jsonb
);

-- The helpers would otherwise be callable by anyone through the API. Signed-in users keep EXECUTE:
-- Postgres inlines a function only when the caller may execute it.
revoke execute on function public.collection_item_filter_flags(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], text,
  uuid, jsonb
) from public, anon;
revoke execute on function public.collection_item_matches(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], text,
  uuid, jsonb
) from public, anon;
grant execute on function public.collection_item_filter_flags(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], text,
  uuid, jsonb
) to authenticated, service_role;
grant execute on function public.collection_item_matches(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], text,
  uuid, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 5. Stats
-- ---------------------------------------------------------------------------------------------------

-- `collection_stats` of `20261010104837_dashboard_stats`, also grouped by custom collection, so the
-- dashboard's "Custom collections" card gets the items and copies per collection from the same call.
-- Only `custom` rows have a collection, so the result grows by the user's collections at most. The
-- return type changes, so the function is dropped and created again (with its grants).

drop function public.collection_stats(text);

create function public.collection_stats(p_time_zone text default 'UTC')
returns table (
  category public.item_category,
  ownership public.ownership_status,
  currency text,
  added_month date,
  custom_collection_id uuid,
  item_count bigint,
  quantity_total bigint,
  estimated_value_total numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    ci.category,
    ci.ownership,
    ci.currency,
    case
      when (ci.created_at at time zone p_time_zone)
        >= date_trunc('month', now() at time zone p_time_zone) - interval '11 months'
        then date_trunc('month', ci.created_at at time zone p_time_zone)::date
    end as added_month,
    ci.custom_collection_id,
    count(*) as item_count,
    sum(ci.quantity)::bigint as quantity_total,
    coalesce(sum(ci.estimated_value * ci.quantity), 0) as estimated_value_total
  from public.collection_items ci
  where ci.user_id = (select auth.uid())
  group by 1, 2, 3, 4, 5;
$$;

revoke execute on function public.collection_stats(text) from public, anon;
grant execute on function public.collection_stats(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 6. Storage
-- ---------------------------------------------------------------------------------------------------

-- Item photos and uploaded covers. Objects are named `<user id>/<uuid>.<ext>`. The bucket is public
-- like `avatars`, so `custom_data.imageUrl` holds a plain public URL that the gallery, exports and a
-- future mobile app can load without signing; the random file names keep the URLs unguessable. Only
-- the owner can list, upload, replace or delete files in their folder. The client compresses images
-- to WebP before upload; the limits match `CUSTOM_IMAGE_MAX_BYTES` / `CUSTOM_IMAGE_MIME_TYPES` in
-- `@fanste/core`. Objects can't be deleted with SQL; deleting an account removes them through the
-- Storage API first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('custom-images', 'custom-images', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can list their own custom images"
on storage.objects for select to authenticated
using (bucket_id = 'custom-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own custom images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'custom-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can replace their own custom images"
on storage.objects for update to authenticated
using (bucket_id = 'custom-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (
  bucket_id = 'custom-images' and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own custom images"
on storage.objects for delete to authenticated
using (bucket_id = 'custom-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
