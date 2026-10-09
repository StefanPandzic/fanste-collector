-- Avatar uploads (FC-06): a public Storage bucket where each user writes only to their own folder.
--
-- Objects are named `<user id>/<file>`. The bucket is public, so `profiles.avatar_url` can hold a plain
-- public URL without signing. Limits match `AVATAR_MAX_BYTES` / `AVATAR_MIME_TYPES` in `@fanste/core`.
-- Objects can't be deleted with SQL; deleting an account removes them through the Storage API first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve files by URL without any policy. This one only lets a user list their own
-- folder (needed to replace and clean up old avatars), not everyone's.
create policy "Users can list their own avatars"
on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can replace their own avatars"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own avatars"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
