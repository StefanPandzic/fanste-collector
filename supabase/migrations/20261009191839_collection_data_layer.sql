-- Collection data layer (FC-14).
--
-- 1. `collection_items_view` also returns the cached `payload` (thumbnail, description, genres,
--    creators, `extra`, source URL), so the repository can build the full provider metadata of an item
--    from one query.
-- 2. `collection_stats()`: counts and value totals for the dashboard (FC-20), computed in the
--    database so large collections don't have to be loaded (PostgREST returns at most 1,000 rows).

-- ---------------------------------------------------------------------------------------------------
-- 1. Gallery view
-- ---------------------------------------------------------------------------------------------------

-- `create or replace` keeps the grants and may only append columns, so the existing ones are repeated
-- unchanged and `metadata_payload` comes last.
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
  mc.payload as metadata_payload
from public.collection_items ci
left join public.metadata_cache mc
  on mc.provider = ci.provider and mc.external_id = ci.external_id;

-- ---------------------------------------------------------------------------------------------------
-- 2. Collection stats
-- ---------------------------------------------------------------------------------------------------

-- One row per category, ownership status and currency of the caller's items. `item_count` counts rows
-- (copies), `quantity_total` adds up their quantities, and `estimated_value_total` is the sum of
-- `estimated_value × quantity` (the value is per unit). Totals are kept per currency because amounts
-- in different currencies can't be added up; `currency` is null for items without one.
-- `security invoker`, so the RLS of `collection_items` applies; the `user_id` filter only lets the
-- planner use the user's index.
create function public.collection_stats()
returns table (
  category public.item_category,
  ownership public.ownership_status,
  currency text,
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
    count(*) as item_count,
    sum(ci.quantity)::bigint as quantity_total,
    coalesce(sum(ci.estimated_value * ci.quantity), 0) as estimated_value_total
  from public.collection_items ci
  where ci.user_id = (select auth.uid())
  group by ci.category, ci.ownership, ci.currency;
$$;

revoke execute on function public.collection_stats() from public, anon;
grant execute on function public.collection_stats() to authenticated, service_role;
