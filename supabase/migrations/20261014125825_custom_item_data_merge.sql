-- Editing hand-entered items (FC-13).
--
-- 1. Checks on `custom_data`, like those on `details` and `metadata_overrides` (FC-15): an object of
--    limited size. `customItemDataSchema` in `@fanste/core` is the source of truth for its fields and
--    allows about half of this limit; the check is the backstop for clients that skip it.
-- 2. `merge_item_custom_data`: the item page autosaves one field at a time, so two devices editing
--    different fields of the same item at once must not overwrite each other (a read-modify-write on
--    the client would).

alter table public.collection_items
  add constraint collection_items_custom_data_object
    check (custom_data is null or jsonb_typeof(custom_data) = 'object'),
  add constraint collection_items_custom_data_size
    check (custom_data is null or octet_length(custom_data::text) <= 32768);

-- Shallow-merges `p_patch` into a hand-entered item's `custom_data`: present keys are set, keys whose
-- value is `null` are removed, other keys are kept. Returns the item's id, or no row if the item
-- doesn't exist, isn't the caller's, or isn't hand-entered. A patch that removes the title is
-- refused, because the view and the normalized item need one. `security invoker`, so the RLS of
-- `collection_items` applies.
create function public.merge_item_custom_data(p_id uuid, p_patch jsonb)
returns setof uuid
language sql
security invoker
set search_path = ''
as $$
  update public.collection_items
  set custom_data = jsonb_strip_nulls(coalesce(custom_data, '{}'::jsonb) || p_patch)
  where id = p_id
    and provider = 'custom'
    and jsonb_typeof(p_patch) = 'object'
    and coalesce(p_patch ->> 'title', custom_data ->> 'title', '') <> ''
  returning id;
$$;

revoke execute on function public.merge_item_custom_data(uuid, jsonb) from public, anon;
grant execute on function public.merge_item_custom_data(uuid, jsonb) to authenticated, service_role;
