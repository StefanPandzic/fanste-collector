-- Scanner background matching (FC-23).
--
-- 1. `match_candidates`: the best TMDB candidates of a scanned file (`{ item, confidence }[]`, best
--    first, at most 5), for the "Fix Match" suggestions (FC-24). `null` until the file is matched.
-- 2. `set_scan_matches(p_matches)`: writes many match results in one statement. Only rows that are
--    still `pending` change, so a choice the user made meanwhile (FC-24) is never overwritten.
-- 3. `set_scanner_settings(p_settings)`: the scanner settings in `profiles.preferences.scanner`
--    (`autoAdd`: add confident matches to the collection), like `set_copy_defaults`.

-- ---------------------------------------------------------------------------------------------------
-- 1. Candidates
-- ---------------------------------------------------------------------------------------------------

alter table public.scanned_files
  add column match_candidates jsonb,
  add constraint scanned_files_match_candidates_array
    check (match_candidates is null or jsonb_typeof(match_candidates) = 'array'),
  add constraint scanned_files_match_candidates_size
    check (match_candidates is null or octet_length(match_candidates::text) <= 16384);

-- ---------------------------------------------------------------------------------------------------
-- 2. Match results
-- ---------------------------------------------------------------------------------------------------

-- `p_matches`: `[{ id, match_status, match_confidence, match_candidates, collection_item_id }]`.
-- RLS applies (security invoker), and the foreign key keeps `collection_item_id` within the user.
create function public.set_scan_matches(p_matches jsonb)
returns setof public.scanned_files
language sql
security invoker
set search_path = ''
as $$
  update public.scanned_files as f
  set
    match_status = m.match_status,
    match_confidence = m.match_confidence,
    match_candidates = coalesce(m.match_candidates, '[]'::jsonb),
    collection_item_id = m.collection_item_id
  from jsonb_to_recordset(p_matches) as m(
    id uuid,
    match_status text,
    match_confidence real,
    match_candidates jsonb,
    collection_item_id uuid
  )
  where f.id = m.id
    and f.match_status = 'pending'
    and m.match_status in ('matched', 'unmatched')
  returning f.*;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 3. Scanner settings
-- ---------------------------------------------------------------------------------------------------

create function public.set_scanner_settings(p_settings jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles
  set preferences = preferences || jsonb_build_object('scanner', p_settings)
  where id = (select auth.uid())
    and jsonb_typeof(p_settings) = 'object'
    and octet_length(p_settings::text) <= 1024;
$$;

revoke execute on function public.set_scan_matches(jsonb) from public, anon;
revoke execute on function public.set_scanner_settings(jsonb) from public, anon;
grant execute on function public.set_scan_matches(jsonb) to authenticated, service_role;
grant execute on function public.set_scanner_settings(jsonb) to authenticated, service_role;
