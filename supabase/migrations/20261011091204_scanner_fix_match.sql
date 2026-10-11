-- Scanner "Fix Match" (FC-24).
--
-- `relink_scanned_files(p_ids, p_status, p_item_id)`: the user's choice for some scanned files, in one
-- transaction:
--   - `manual` links them to `p_item_id` (a copy the client found or added first),
--   - `ignored` unlinks them and keeps them out of matching,
--   - `pending` unlinks them and hands them back to the background matcher (FC-23).
-- Unlike `set_scan_matches` it changes files in any status, because the user's choice wins. Then every
-- item the files were linked to before is deleted if the scanner added it (`source = 'scanner'`) and
-- no scanned file, on any device, links to it any more, so a wrong match leaves no orphaned item.
-- Returns `{ files: scanned_files rows, removedItemIds: uuid[] }`.
--
-- The FC-05 unlink trigger doesn't interfere: it only acts on rows whose new status is `matched` or
-- `manual` and whose item becomes `null`, which this function never writes.

create function public.relink_scanned_files(
  p_ids uuid[],
  p_status text,
  p_item_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous uuid[];
  v_files jsonb;
  v_removed jsonb;
begin
  if p_status is null
    or p_status not in ('manual', 'ignored', 'pending')
    or (p_status = 'manual') <> (p_item_id is not null)
    or coalesce(cardinality(p_ids), 0) > 1000 then
    raise exception 'Invalid relink request.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct f.collection_item_id), '{}')
  into v_previous
  from public.scanned_files as f
  where f.id = any(p_ids)
    and f.collection_item_id is not null
    and f.collection_item_id is distinct from p_item_id;

  -- RLS applies, and the foreign key keeps `p_item_id` within the user.
  with updated as (
    update public.scanned_files as f
    set match_status = p_status, collection_item_id = p_item_id
    where f.id = any(p_ids)
    returning f.*
  )
  select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) into v_files from updated as u;

  with removed as (
    delete from public.collection_items as i
    where i.id = any(v_previous)
      and i.source = 'scanner'
      and not exists (
        select 1 from public.scanned_files as f where f.collection_item_id = i.id
      )
    returning i.id
  )
  select coalesce(jsonb_agg(r.id), '[]'::jsonb) into v_removed from removed as r;

  return jsonb_build_object('files', v_files, 'removedItemIds', v_removed);
end;
$$;

revoke execute on function public.relink_scanned_files(uuid[], text, uuid) from public, anon;
grant execute on function public.relink_scanned_files(uuid[], text, uuid) to authenticated, service_role;
