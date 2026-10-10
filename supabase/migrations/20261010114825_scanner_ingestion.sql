-- Scanner directory ingestion (FC-21).
--
-- 1. `path_key`: the file's identity on its device. `file_path` keeps the real case for display and
--    for the filename parser (FC-22), but Windows and default macOS file systems are case-insensitive,
--    so the desktop app writes a normalized key (separators as `/`, lowercased there) and the unique
--    constraint moves to it.
-- 2. `subtitle_languages`: languages of the sidecar subtitle files next to the video (`Movie.en.srt`),
--    which can't be derived from the path later. FC-23 copies them to `details.subtitleLanguages`.
-- 3. An index for loading a device's current files, which every scan does first.

-- ---------------------------------------------------------------------------------------------------
-- 1. Path key
-- ---------------------------------------------------------------------------------------------------

alter table public.scanned_files add column path_key text;

update public.scanned_files set path_key = file_path where path_key is null;

alter table public.scanned_files
  alter column path_key set not null,
  add constraint scanned_files_path_key_length check (char_length(path_key) between 1 and 4096),
  add constraint scanned_files_file_path_length check (char_length(file_path) between 1 and 4096),
  add constraint scanned_files_device_id_length check (char_length(device_id) between 1 and 100);

alter table public.scanned_files
  drop constraint scanned_files_user_id_device_id_file_path_key,
  add constraint scanned_files_user_id_device_id_path_key_key unique (user_id, device_id, path_key);

-- ---------------------------------------------------------------------------------------------------
-- 2. Subtitle languages
-- ---------------------------------------------------------------------------------------------------

alter table public.scanned_files
  add column subtitle_languages text[] not null default '{}',
  add constraint scanned_files_subtitle_languages_count
    check (coalesce(array_length(subtitle_languages, 1), 0) <= 50);

-- ---------------------------------------------------------------------------------------------------
-- 3. Device index
-- ---------------------------------------------------------------------------------------------------

-- The unique constraint already covers lookups by (user_id, device_id); this one keeps the
-- "current files" list (what the scanner page shows) small as removed files pile up.
create index scanned_files_current_idx on public.scanned_files (user_id, device_id)
where removed_at is null;
