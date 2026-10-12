-- Music gallery filters (FC-10).
--
-- Adds the music copy-details filters to the one filter implementation, `collection_item_filter_flags`
-- (flags 13-15: `vinylSize`, `mediaCondition`, `sleeveCondition`), and their counts to
-- `collection_facets`. The bodies are otherwise those of
-- `20261010082954_collection_gallery_filters_inline`;
-- keep them inlinable (no `set search_path` on the flags, no subqueries, scalar arguments).
-- `create or replace` keeps the signatures and the grants. `collection_item_matches` and
-- `collection_items_filtered` read the flags array as a whole, so they need no change.

-- Whether an item passes each filter, as an array of 15 flags in this order: 1 `category`,
-- 2 `ownership[]`, 3 `formats[]` (a TV season's medium counts too), 4 `sources[]`, 5 `tagIds[]`,
-- 6 `acquiredFrom` / `acquiredTo` (inclusive dates), 7 `search` (title or subtitle, literal), and the
-- `details` filters 8 `resolution[]`, 9 `hdr[]`, 10 `edition[]`, 11 `audioLanguages[]`,
-- 12 `subtitleLanguages[]`, 13 `vinylSize[]`, 14 `mediaCondition[]`, 15 `sleeveCondition[]`. A
-- filter that is off passes. Within a filter, any of its values matches.
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
      )
  ]
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
      ('subtitleLanguage', 12, 'subtitleLanguages[*]'),
      ('vinylSize', 13, 'vinylSize'),
      ('mediaCondition', 14, 'mediaCondition'),
      ('sleeveCondition', 15, 'sleeveCondition')
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
