-- Fix of `merge_item_custom_data` (FC-13): a patch with `"title": null` removed the title, because
-- `p_patch ->> 'title'` is SQL null for a JSON null and the check fell back to the stored title. A
-- patch that has a `title` key must now give a non-empty string; other patches keep the stored one.

create or replace function public.merge_item_custom_data(p_id uuid, p_patch jsonb)
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
    and (
      not (p_patch ? 'title')
      or (jsonb_typeof(p_patch -> 'title') = 'string' and btrim(p_patch ->> 'title') <> '')
    )
  returning id;
$$;
