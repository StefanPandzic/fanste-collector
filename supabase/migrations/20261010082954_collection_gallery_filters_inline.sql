-- Collection gallery filters: make them fast (FC-18).
--
-- Measured with 1,000 items (EXPLAIN ANALYZE), the filters ran as one SQL function call per item and
-- facet, about 0.15 ms each, because the planner couldn't inline them, and the facets re-ran the
-- whole filter once per facet:
--
-- 1. `collection_item_matches` took the whole `collection_items_view` row. That argument is a
--    `ROW(...)` of the view's computed columns, and Postgres doesn't inline a function whose expensive
--    argument is used more than once. It now takes only the columns it filters on.
-- 2. `collection_details_match` was declared immutable, but `jsonb_build_object` and `format()` are
--    only stable, and a function whose body is less strict than declared is never inlined.
-- 3. `collection_items_filtered` had `set search_path`, which prevents inlining a set-returning
--    function, so it built every matching row (with its metadata payload) before PostgREST could
--    sort, page and count. Inlined, the planner applies those to the query itself. Its body is
--    schema-qualified, and as `security invoker` it runs with the caller's rights either way.
-- 4. The filter is split into one flag per filter (`collection_item_filter_flags`), still its only
--    implementation. `collection_item_matches` is "no flag is false"; `collection_facets` computes
--    the flags once per item and counts an item for a facet when no other filter fails.
-- 5. `assign_tag_to_items` tags many items at once and skips ids that are no longer the caller's
--    items, so one item deleted on another device doesn't fail the whole bulk action.
-- 6. The filter helpers lose the default EXECUTE grant to `anon`, like every other function here.

create or replace function public.collection_details_match(
  p_details jsonb,
  p_path text,
  p_values jsonb
)
returns boolean
language sql
stable
as $$
  select
    jsonb_path_exists(
      p_details,
      ('lax $.' || p_path || ' ? (@ == $v[*])')::jsonpath,
      jsonb_build_object('v', p_values)
    )
    or jsonb_path_exists(
      p_details,
      ('lax $.seasons[*].' || p_path || ' ? (@ == $v[*])')::jsonpath,
      jsonb_build_object('v', p_values)
    )
$$;

drop function if exists public.collection_item_matches(public.collection_items_view, uuid[], jsonb);

-- Whether an item passes each filter, as an array of 12 flags in this order: 1 `category`,
-- 2 `ownership[]`, 3 `formats[]` (a TV season's medium counts too), 4 `sources[]`, 5 `tagIds[]`,
-- 6 `acquiredFrom` / `acquiredTo` (inclusive dates), 7 `search` (title or subtitle, literal), and the
-- `details` filters 8 `resolution[]`, 9 `hdr[]`, 10 `edition[]`, 11 `audioLanguages[]`,
-- 12 `subtitleLanguages[]`. A filter that is off passes. Within a filter, any of its values matches.
-- The arguments are the item's columns in `collection_items_view` and its tag IDs.
create or replace function public.collection_item_filter_flags(
  p_category public.item_category,
  p_ownership public.ownership_status,
  p_format text,
  p_source text,
  p_acquired_at date,
  p_title text,
  p_subtitle text,
  p_details jsonb,
  p_tag_ids uuid[],
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
      )
  ]
$$;

-- Whether an item passes every filter (see `collection_item_filter_flags`).
create or replace function public.collection_item_matches(
  p_category public.item_category,
  p_ownership public.ownership_status,
  p_format text,
  p_source text,
  p_acquired_at date,
  p_title text,
  p_subtitle text,
  p_details jsonb,
  p_tag_ids uuid[],
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
        p_details, p_tag_ids, p_filter
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
      tags.ids, p_filter
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
      public.collection_item_filter_flags(
        v.category, v.ownership, v.format, v.source, v.acquired_at, v.title, v.subtitle, v.details,
        tags.ids, p_filter
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
      ('subtitleLanguage', 12, 'subtitleLanguages[*]')
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

-- ---------------------------------------------------------------------------------------------------
-- Bulk tagging
-- ---------------------------------------------------------------------------------------------------

-- Puts a tag on many of the caller's items; returns how many links were added. Ids that aren't the
-- caller's items (e.g. deleted on another device meanwhile) are skipped instead of failing the whole
-- batch on the foreign key, and items that already have the tag are left alone. `security invoker`,
-- so the RLS of both tables applies.
create function public.assign_tag_to_items(p_tag_id uuid, p_item_ids uuid[])
returns integer
language sql
security invoker
set search_path = ''
as $$
  with added as (
    insert into public.collection_item_tags (item_id, tag_id)
    select ci.id, p_tag_id
    from public.collection_items ci
    where ci.id = any(p_item_ids) and ci.user_id = (select auth.uid())
    on conflict do nothing
    returning 1
  )
  select count(*)::integer from added;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------

-- The helpers would otherwise be callable by anyone through the API (`/rest/v1/rpc/...`). Signed-in
-- users keep EXECUTE: Postgres inlines a function only when the caller may execute it.
revoke execute on function public.collection_filter_off(jsonb) from public, anon;
revoke execute on function public.collection_escape_like(text) from public, anon;
revoke execute on function public.collection_details_match(jsonb, text, jsonb) from public, anon;
revoke execute on function public.collection_item_filter_flags(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], jsonb
) from public, anon;
revoke execute on function public.collection_item_matches(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], jsonb
) from public, anon;
revoke execute on function public.assign_tag_to_items(uuid, uuid[]) from public, anon;
grant execute on function public.collection_filter_off(jsonb) to authenticated, service_role;
grant execute on function public.collection_escape_like(text) to authenticated, service_role;
grant execute on function public.collection_details_match(jsonb, text, jsonb)
  to authenticated, service_role;
grant execute on function public.collection_item_filter_flags(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], jsonb
) to authenticated, service_role;
grant execute on function public.collection_item_matches(
  public.item_category, public.ownership_status, text, text, date, text, text, jsonb, uuid[], jsonb
) to authenticated, service_role;
grant execute on function public.assign_tag_to_items(uuid, uuid[]) to authenticated, service_role;
