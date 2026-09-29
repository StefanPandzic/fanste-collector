-- Sample data for the dev Supabase Cloud project only. Never push it to prod.
--
-- Applied with `pnpm db:push --include-seed` while the CLI is linked to the dev project
-- (see README → Supabase). Keep the statements idempotent (`on conflict do nothing`), because the CLI
-- runs the file again whenever it changes.
--
-- Only the shared metadata cache is seeded: collection items belong to a user, so they are added
-- through the app. The rows have no images and an old `fetched_at`, so the gateway treats them as
-- stale and refreshes them on first use (FC-08).
insert into public.metadata_cache (provider, external_id, category, title, subtitle, release_year, fetched_at)
values
  ('tmdb', 'movie:603', 'movie', 'The Matrix', null, 1999, '2000-01-01'),
  ('tmdb', 'tv:1396', 'tv', 'Breaking Bad', null, 2008, '2000-01-01'),
  ('discogs', 'release:249504', 'music', 'Never Gonna Give You Up', 'Rick Astley', 1987, '2000-01-01'),
  ('igdb', '1942', 'video_game', 'The Witcher 3: Wild Hunt', 'CD Projekt Red', 2015, '2000-01-01'),
  ('bgg', '13', 'board_game', 'CATAN', 'Klaus Teuber', 1995, '2000-01-01')
on conflict do nothing;
