-- Scanner media info (FC-22).
--
-- `media_info`: what the desktop app read from a video file's own headers (container, resolution,
-- HDR, audio channels, audio and embedded subtitle languages), as the FC-15 copy-detail fields.
-- `null` means the file hasn't been read yet (new, or changed since it was read); `{}` means it was
-- read but nothing could be told. The matcher (FC-23) prefers these values to the filename's.
-- The app validates the shape (`mediaInfoShape` in `@fanste/core`); the checks are the backstop.

alter table public.scanned_files
  add column media_info jsonb,
  add constraint scanned_files_media_info_object
    check (media_info is null or jsonb_typeof(media_info) = 'object'),
  add constraint scanned_files_media_info_size
    check (media_info is null or octet_length(media_info::text) <= 8192);
