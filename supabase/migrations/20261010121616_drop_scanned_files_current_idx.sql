-- FC-21 review: the scanner loads every row of a device (removed ones included, to recognize a
-- returning file), which the `(user_id, device_id, path_key)` unique constraint already serves. The
-- partial "current files" index from 20261010114825_scanner_ingestion.sql had no query.
drop index if exists public.scanned_files_current_idx;
