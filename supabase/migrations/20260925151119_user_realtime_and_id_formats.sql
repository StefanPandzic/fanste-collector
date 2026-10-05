-- Review fixes for the initial schema (FC-05).
--
-- 1. External ID formats. TMDB uses separate ID spaces for movies and TV, so its IDs carry the category
--    as a prefix (`movie:603`, `tv:1396`), like Discogs (`release:249504`, `master:…`, FC-10). The
--    `(provider, external_id)` keys stay unique across both.
-- 2. Realtime via per-user Broadcast instead of Postgres Changes. Postgres Changes doesn't apply RLS
--    to DELETE events, so every subscriber would receive the keys of every user's deleted rows.
-- 3. Smaller fixes: a case- and space-insensitive `format_key`, scanned files that lose their item go
--    back to review, and length/scheme limits on the profile fields that sign-up metadata fills.

-- ---------------------------------------------------------------------------------------------------
-- 1. External ID formats
-- ---------------------------------------------------------------------------------------------------

-- Rows written before this migration (dev seed and tests only) used bare numbers.
update public.metadata_cache
set external_id = category::text || ':' || external_id
where provider = 'tmdb' and external_id ~ '^[0-9]+$';

update public.metadata_cache
set external_id = 'release:' || external_id
where provider = 'discogs' and external_id ~ '^[0-9]+$';

update public.collection_items
set external_id = category::text || ':' || external_id
where provider = 'tmdb' and external_id ~ '^[0-9]+$';

update public.collection_items
set external_id = 'release:' || external_id
where provider = 'discogs' and external_id ~ '^[0-9]+$';

-- TMDB: `<category>:<id>`, so the prefix always matches the row's category. Discogs:
-- `release:<id>` or `master:<id>`. IGDB and BGG: the numeric ID.
alter table public.metadata_cache add constraint metadata_cache_external_id_format check (
  (provider = 'tmdb' and external_id ~ ('^' || category::text || ':[0-9]+$'))
  or (provider = 'discogs' and external_id ~ '^(release|master):[0-9]+$')
  or (provider in ('igdb', 'bgg') and external_id ~ '^[0-9]+$')
);

alter table public.collection_items add constraint collection_items_external_id_format check (
  provider = 'custom'
  or (provider = 'tmdb' and external_id ~ ('^' || category::text || ':[0-9]+$'))
  or (provider = 'discogs' and external_id ~ '^(release|master):[0-9]+$')
  or (provider in ('igdb', 'bgg') and external_id ~ '^[0-9]+$')
);

-- ---------------------------------------------------------------------------------------------------
-- 2. Realtime: per-user Broadcast
-- ---------------------------------------------------------------------------------------------------

alter publication supabase_realtime drop table public.collection_items, public.collection_item_tags;

-- Sends every change of a user's items and tag links to that user's private topic `user:<user_id>`
-- (FC-14 subscribes with `supabase.channel('user:<id>', { config: { private: true } })`). The event
-- name is the operation (`INSERT`, `UPDATE`, `DELETE`); the payload holds the new and old rows.
create function public.broadcast_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'user:' || coalesce(new.user_id, old.user_id)::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke execute on function public.broadcast_user_change() from public, anon, authenticated;

create trigger collection_items_broadcast
after insert or update or delete on public.collection_items
for each row execute function public.broadcast_user_change();

create trigger collection_item_tags_broadcast
after insert or update or delete on public.collection_item_tags
for each row execute function public.broadcast_user_change();

-- A user may join only their own topic. There is no insert policy, so clients can't send to it:
-- only the triggers above do.
create policy "Users can receive their own collection changes"
on realtime.messages for select to authenticated
using (
  (select realtime.topic()) = 'user:' || (select auth.uid())::text
  and realtime.messages.extension = 'broadcast'
);

-- ---------------------------------------------------------------------------------------------------
-- 3. Smaller fixes
-- ---------------------------------------------------------------------------------------------------

-- `format` is free text (FC-15 allows "Other"), so 'DVD', 'dvd' and 'DVD ' are the same copy.
alter table public.collection_items
alter column format_key set expression as (lower(btrim(coalesce(format, ''))));

-- When a matched file's item is deleted (`on delete set null`), the file goes back to review (FC-24)
-- instead of staying "matched" to nothing. `unmatched`, not `pending`, so the background matcher
-- (FC-23) doesn't silently re-add an item the user deleted.
create function public.scanned_files_unmatch_on_unlink()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.collection_item_id is null
    and old.collection_item_id is not null
    and new.match_status in ('matched', 'manual') then
    new.match_status = 'unmatched';
  end if;
  return new;
end;
$$;

revoke execute on function public.scanned_files_unmatch_on_unlink() from public, anon, authenticated;

create trigger scanned_files_unmatch_on_unlink
before update of collection_item_id on public.scanned_files
for each row execute function public.scanned_files_unmatch_on_unlink();

-- Sign-up metadata is set by the client (`signUp({ options: { data } })`), so limit what reaches the
-- profile. The trigger trims values instead of failing, so an odd value never blocks a sign-up.
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 100),
  add constraint profiles_avatar_url_format check (
    avatar_url ~ '^https://' and char_length(avatar_url) <= 2048
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name_value text := nullif(
    btrim(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 100)),
    ''
  );
  avatar_value text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
begin
  if avatar_value !~ '^https://' or char_length(avatar_value) > 2048 then
    avatar_value := null;
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, name_value, avatar_value)
  on conflict (id) do nothing;
  return new;
end;
$$;
