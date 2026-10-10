-- Collection gallery filters (FC-18).
--
-- The gallery filters, searches and counts in the database, so a large collection never has to be
-- loaded into the client (PostgREST returns at most 1,000 rows per request).
--
-- 1. `collection_item_matches(item, tag_ids, filter)`: the one implementation of the gallery
--    filters. The filter is the `CollectionFilter` of `@fanste/core` as JSON; its keys are this
--    function's contract.
-- 2. `collection_items_filtered(filter)`: the caller's items that match. PostgREST orders, pages and
--    counts the result and embeds the tag links, like it does for `collection_items_view`.
-- 3. `collection_facets(filter)`: items per value of each filter, for "Blu-ray (12)". Each facet
--    applies every other filter but its own, so the other values keep their counts while one is
--    selected.
--
-- The two entry points are `security invoker`, so the RLS of `collection_items` applies; the
-- `user_id` filters only let the planner use the user's indexes.
--
-- The helpers run for every item and facet, so they are written to be inlined into the calling
-- query: one `select` expression, no subqueries, and no `set search_path` (which prevents inlining).
-- Every name in them is schema-qualified or a `pg_catalog` built-in, which is always searched first.

-- ---------------------------------------------------------------------------------------------------
-- 1. Filter
-- ---------------------------------------------------------------------------------------------------

-- Whether a filter value list is unset or empty, i.e. the filter is off.
create function public.collection_filter_off(p_values jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_values) is distinct from 'array' or jsonb_array_length(p_values) = 0
$$;

-- Escapes `\`, `%` and `_`, so search text matches literally in `ilike`.
create function public.collection_escape_like(p_text text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- Whether `p_details`, or for TV any entry of its `seasons`, has one of `p_values` at `p_path`
-- (`resolution`, or `audioLanguages[*]` for an array field). Lax JSON paths skip missing or
-- malformed fields instead of failing.
create function public.collection_details_match(p_details jsonb, p_path text, p_values jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_path_exists(
      p_details,
      format('lax $.%s ? (@ == $v[*])', p_path)::jsonpath,
      jsonb_build_object('v', p_values)
    )
    or jsonb_path_exists(
      p_details,
      format('lax $.seasons[*].%s ? (@ == $v[*])', p_path)::jsonpath,
      jsonb_build_object('v', p_values)
    )
$$;

-- Whether an item with the tags `p_tag_ids` matches the filter. Filters combine with AND; within a
-- filter, any of its values matches. Keys: `category`, `ownership[]`, `formats[]` (a TV season's
-- medium counts too), `tagIds[]`, `sources[]`, `acquiredFrom` and `acquiredTo` (inclusive dates),
-- `search` (title or subtitle, literal), and `details` with `resolution[]`, `hdr[]`, `edition[]`,
-- `audioLanguages[]` and `subtitleLanguages[]`.
create function public.collection_item_matches(
  p_item public.collection_items_view,
  p_tag_ids uuid[],
  p_filter jsonb
)
returns boolean
language sql
stable
as $$
  select
    (p_filter ->> 'category' is null or p_item.category::text = p_filter ->> 'category')
    and (
      public.collection_filter_off(p_filter -> 'ownership')
      or (p_filter -> 'ownership') ? p_item.ownership::text
    )
    and (
      public.collection_filter_off(p_filter -> 'formats')
      or coalesce((p_filter -> 'formats') ? p_item.format, false)
      or public.collection_details_match(p_item.details, 'format', p_filter -> 'formats')
    )
    and (
      public.collection_filter_off(p_filter -> 'sources')
      or (p_filter -> 'sources') ? p_item.source
    )
    and (
      public.collection_filter_off(p_filter -> 'tagIds')
      or (p_filter -> 'tagIds') ?| p_tag_ids::text[]
    )
    and (
      p_filter ->> 'acquiredFrom' is null
      or coalesce(p_item.acquired_at >= (p_filter ->> 'acquiredFrom')::date, false)
    )
    and (
      p_filter ->> 'acquiredTo' is null
      or coalesce(p_item.acquired_at <= (p_filter ->> 'acquiredTo')::date, false)
    )
    and (
      coalesce(p_filter ->> 'search', '') = ''
      or coalesce(
        p_item.title ilike '%' || public.collection_escape_like(p_filter ->> 'search') || '%',
        false
      )
      or coalesce(
        p_item.subtitle ilike '%' || public.collection_escape_like(p_filter ->> 'search') || '%',
        false
      )
    )
    and (
      public.collection_filter_off(p_filter -> 'details' -> 'resolution')
      or public.collection_details_match(
        p_item.details, 'resolution', p_filter -> 'details' -> 'resolution'
      )
    )
    and (
      public.collection_filter_off(p_filter -> 'details' -> 'hdr')
      or public.collection_details_match(p_item.details, 'hdr', p_filter -> 'details' -> 'hdr')
    )
    and (
      public.collection_filter_off(p_filter -> 'details' -> 'edition')
      or public.collection_details_match(
        p_item.details, 'edition', p_filter -> 'details' -> 'edition'
      )
    )
    and (
      public.collection_filter_off(p_filter -> 'details' -> 'audioLanguages')
      or public.collection_details_match(
        p_item.details, 'audioLanguages[*]', p_filter -> 'details' -> 'audioLanguages'
      )
    )
    and (
      public.collection_filter_off(p_filter -> 'details' -> 'subtitleLanguages')
      or public.collection_details_match(
        p_item.details, 'subtitleLanguages[*]', p_filter -> 'details' -> 'subtitleLanguages'
      )
    )
$$;

-- ---------------------------------------------------------------------------------------------------
-- 2. Filtered items
-- ---------------------------------------------------------------------------------------------------

create function public.collection_items_filtered(p_filter jsonb default '{}'::jsonb)
returns setof public.collection_items_view
language sql
stable
security invoker
set search_path = ''
as $$
  select v.*
  from public.collection_items_view v
  cross join lateral (
    select coalesce(array_agg(t.tag_id), '{}') as ids
    from public.collection_item_tags t
    where t.item_id = v.id
  ) tags
  where v.user_id = (select auth.uid()) and public.collection_item_matches(v, tags.ids, p_filter);
$$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Facet counts
-- ---------------------------------------------------------------------------------------------------

-- One row per facet and value: how many of the caller's items (copies) match `p_filter` with that
-- facet's own filter removed and have the value. A TV copy counts once per value, even when the show
-- and several of its seasons have it.
create function public.collection_facets(p_filter jsonb default '{}'::jsonb)
returns table (facet text, value text, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with items as materialized (
    select v as item, tags.ids as tag_ids
    from public.collection_items_view v
    cross join lateral (
      select coalesce(array_agg(t.tag_id), '{}') as ids
      from public.collection_item_tags t
      where t.item_id = v.id
    ) tags
    where v.user_id = (select auth.uid())
  ),
  -- Per facet: the filter without the facet's own key, and the facet's JSON path in `details`.
  facets (facet, filter, path) as (
    values
      ('category', p_filter - 'category', null),
      ('ownership', p_filter - 'ownership', null),
      ('source', p_filter - 'sources', null),
      ('tag', p_filter - 'tagIds', null),
      ('format', p_filter - 'formats', null),
      ('resolution', p_filter #- '{details,resolution}', 'resolution'),
      ('hdr', p_filter #- '{details,hdr}', 'hdr'),
      ('edition', p_filter #- '{details,edition}', 'edition'),
      ('audioLanguage', p_filter #- '{details,audioLanguages}', 'audioLanguages[*]'),
      ('subtitleLanguage', p_filter #- '{details,subtitleLanguages}', 'subtitleLanguages[*]')
  ),
  facet_values as (
    select f.facet, (i.item).id, v.value
    from facets f
    cross join items i
    cross join lateral (
      -- The values the item has for this facet (deduplicated per item by `union`). The path queries
      -- are evaluated for every facet, so a facet without a path reads a key that never exists.
      select (i.item).category::text where f.facet = 'category'
      union
      select (i.item).ownership::text where f.facet = 'ownership'
      union
      select (i.item).source where f.facet = 'source'
      union
      select unnest(i.tag_ids)::text where f.facet = 'tag'
      union
      select (i.item).format where f.facet = 'format'
      union
      select s #>> '{}'
      from jsonb_path_query((i.item).details, 'lax $.seasons[*].format') s
      where f.facet = 'format' and jsonb_typeof(s) = 'string'
      union
      select s #>> '{}'
      from jsonb_path_query(
        (i.item).details, format('lax $.%s', coalesce(f.path, 'none'))::jsonpath
      ) s
      where f.path is not null and jsonb_typeof(s) = 'string'
      union
      select s #>> '{}'
      from jsonb_path_query(
        (i.item).details, format('lax $.seasons[*].%s', coalesce(f.path, 'none'))::jsonpath
      ) s
      where f.path is not null and jsonb_typeof(s) = 'string'
    ) v(value)
    where public.collection_item_matches(i.item, i.tag_ids, f.filter)
  )
  select facet, value, count(*) as item_count
  from facet_values
  where value is not null
  group by facet, value;
$$;

revoke execute on function public.collection_items_filtered(jsonb) from public, anon;
revoke execute on function public.collection_facets(jsonb) from public, anon;
grant execute on function public.collection_items_filtered(jsonb) to authenticated, service_role;
grant execute on function public.collection_facets(jsonb) to authenticated, service_role;
