-- Item details & manual overrides (FC-15).
--
-- 1. Checks on the user-owned jsonb columns: `details` (the user's copy) and `metadata_overrides`
--    (corrections of provider fields) must be objects of limited size. The zod schemas in
--    `@fanste/core` are the source of truth for their fields and allow about half of these limits;
--    the checks are the backstop for clients that skip them. `octet_length(col::text)` is used rather
--    than `pg_column_size`, which measures the compressed value.
-- 2. GIN index on `details` for filters such as "all 4K movies" (`details @> '{"resolution":"2160p"}'`,
--    FC-18).
-- 3. Merge functions, so two devices editing different fields of the same item at once don't
--    overwrite each other (a read-modify-write on the client would).
--
-- `collection_items_view` already returns the display values with overrides applied plus the raw
-- provider values (FC-05, FC-14), so it is unchanged. A metadata refresh writes only `metadata_cache`
-- and never touches these columns.

-- ---------------------------------------------------------------------------------------------------
-- 1. Checks
-- ---------------------------------------------------------------------------------------------------

alter table public.collection_items
  add constraint collection_items_details_object check (jsonb_typeof(details) = 'object'),
  add constraint collection_items_details_size check (octet_length(details::text) <= 16384),
  add constraint collection_items_metadata_overrides_object
    check (jsonb_typeof(metadata_overrides) = 'object'),
  add constraint collection_items_metadata_overrides_size
    check (octet_length(metadata_overrides::text) <= 32768);

-- `preferences` is already checked to be an object (FC-05).
alter table public.profiles
  add constraint profiles_preferences_size check (octet_length(preferences::text) <= 32768);

-- ---------------------------------------------------------------------------------------------------
-- 2. Index
-- ---------------------------------------------------------------------------------------------------

-- `jsonb_path_ops` supports only `@>`, which is all the filters need, and is smaller than the default.
create index collection_items_details_idx
  on public.collection_items using gin (details jsonb_path_ops);

-- ---------------------------------------------------------------------------------------------------
-- 3. Merge functions
-- ---------------------------------------------------------------------------------------------------

-- Shallow-merges `p_patch` into an item's `details`: present keys are set, keys whose value is `null`
-- are removed, other keys are kept. Returns the item's id, or no row if the item doesn't exist or
-- isn't the caller's. `security invoker`, so the RLS of `collection_items` applies. A non-object patch
-- fails the `collection_items_details_object` check.
create function public.merge_item_details(p_id uuid, p_patch jsonb)
returns setof uuid
language sql
security invoker
set search_path = ''
as $$
  update public.collection_items
  set details = jsonb_strip_nulls(details || p_patch)
  where id = p_id
  returning id;
$$;

-- The same for `metadata_overrides`: a `null` value resets that field to the provider's value.
create function public.merge_item_overrides(p_id uuid, p_patch jsonb)
returns setof uuid
language sql
security invoker
set search_path = ''
as $$
  update public.collection_items
  set metadata_overrides = jsonb_strip_nulls(metadata_overrides || p_patch)
  where id = p_id
  returning id;
$$;

-- Stores the caller's last-used medium and detail habits for a category in
-- `profiles.preferences.copyDefaults.<category>`, keeping the other categories and preference keys.
create function public.set_copy_defaults(p_category public.item_category, p_defaults jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles
  set preferences = preferences || jsonb_build_object(
    'copyDefaults',
    case
      when jsonb_typeof(preferences -> 'copyDefaults') = 'object' then preferences -> 'copyDefaults'
      else '{}'::jsonb
    end || jsonb_build_object(p_category::text, p_defaults)
  )
  where id = (select auth.uid());
$$;

revoke execute on function public.merge_item_details(uuid, jsonb) from public, anon;
revoke execute on function public.merge_item_overrides(uuid, jsonb) from public, anon;
revoke execute on function public.set_copy_defaults(public.item_category, jsonb) from public, anon;
grant execute on function public.merge_item_details(uuid, jsonb) to authenticated, service_role;
grant execute on function public.merge_item_overrides(uuid, jsonb) to authenticated, service_role;
grant execute on function public.set_copy_defaults(public.item_category, jsonb)
  to authenticated, service_role;
