-- Copy details read from the file itself (FC-23).
--
-- `file_details`: the copy details the scanner wrote from a video file's own headers (container,
-- resolution, HDR, audio channels, audio and subtitle languages), as it wrote them. The item page
-- compares `details` with it: a value that is still the same is marked "from file", a changed one
-- "edited". Values guessed from the file name aren't recorded. `{}` for copies the scanner didn't
-- fill. Informational only: the user owns the row, so RLS lets them write it too.
--
-- `merge_item_file_details(p_id, p_values)`: adds recorded values when the scanner fills empty
-- fields of an existing copy (`details` itself is merged by `merge_item_details`).

alter table public.collection_items
  add column file_details jsonb not null default '{}',
  add constraint collection_items_file_details_object check (jsonb_typeof(file_details) = 'object'),
  add constraint collection_items_file_details_size check (octet_length(file_details::text) <= 8192);

create function public.merge_item_file_details(p_id uuid, p_values jsonb)
returns setof uuid
language sql
security invoker
set search_path = ''
as $$
  update public.collection_items
  set file_details = file_details || p_values
  where id = p_id
    and jsonb_typeof(p_values) = 'object'
  returning id;
$$;

revoke execute on function public.merge_item_file_details(uuid, jsonb) from public, anon;
grant execute on function public.merge_item_file_details(uuid, jsonb) to authenticated, service_role;
