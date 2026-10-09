-- Item details: check the category on merge (FC-15 review).
--
-- The client validates a details patch against the zod schema of the category it names. Matching
-- that category against the stored row makes sure a patch checked as one category (e.g. a loose music
-- record) can't be merged into an item of another (a typed movie).

drop function public.merge_item_details(uuid, jsonb);

-- Shallow-merges `p_patch` into the `details` of an item of category `p_category`: present keys are
-- set, keys whose value is `null` are removed, other keys are kept. Returns the item's id, or no row if
-- the item doesn't exist, isn't the caller's, or has another category. `security invoker`, so the RLS
-- of `collection_items` applies.
create function public.merge_item_details(
  p_id uuid,
  p_category public.item_category,
  p_patch jsonb
)
returns setof uuid
language sql
security invoker
set search_path = ''
as $$
  update public.collection_items
  set details = jsonb_strip_nulls(details || p_patch)
  where id = p_id and category = p_category
  returning id;
$$;

revoke execute on function public.merge_item_details(uuid, public.item_category, jsonb)
  from public, anon;
grant execute on function public.merge_item_details(uuid, public.item_category, jsonb)
  to authenticated, service_role;
