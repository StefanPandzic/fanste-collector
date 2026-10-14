# FC-33 — Steam library sync (import owned games)

**Phase:** 5 — Post-v1 follow-ups · **Depends on:** FC-11, FC-14, FC-24 · **Category:** `video_game` ·
**Platforms:** web, desktop

## Goal
Let a user link their Steam account and import the games it owns into their collection, each as an IGDB game
with a `Digital` copy on Steam for PC. A "Sync now" button adds games bought since the last sync. Steam has no API
to change a library, so the sync only goes from Steam to Fanste.

## Decisions (agreed before the task was written)
- **Linking:** the user pastes their Steam profile URL, custom URL name or SteamID64. There's no Steam sign-in, so
  no per-user tokens are stored. Anyone can link any public profile, which is acceptable because the data is
  public anyway.
- **Sync:** a first import, then "Sync now" on demand; there's no background sync. Games that disappear from the
  Steam library (refunds, removed licenses) are listed for the user to confirm and are never deleted
  automatically.
- **Games without an IGDB match:** a review list where the user picks the right game with a Fix Match search
  (like the scanner's, FC-24) or ignores it.
- **Data:** only ownership is imported. Playtime and last-played date are not.

## Subtasks
- [ ] Steam Web API key: one key for the app (`STEAM_WEB_API_KEY`), server-only. Add it to the web env schema,
      `.env.example` and `SECRET_ENV_VARS` in `scripts/check-client-bundle.mjs`. Send it only from the gateway.
- [ ] Steam client in the gateway (`apps/web/src/server/steam/`), every call throttled and retried like a
      provider (`providerFetch`, or a `steam` entry with its own limits in `limits.ts`; the key is a query
      parameter on Steam, so never log the full URL):
  - [ ] Parse the pasted value into a SteamID64:
    - `https://steamcommunity.com/profiles/<17 digits>` and a bare 17-digit ID (checked to be a valid
      individual account ID);
    - `https://steamcommunity.com/id/<name>` and a bare custom name, through `ISteamUser/ResolveVanityURL`.
  - [ ] `ISteamUser/GetPlayerSummaries`: the persona name and avatar, shown as "Linked to <name>".
  - [ ] `IPlayerService/GetOwnedGames` with `include_appinfo=1` (name and icon for the review list).
        Free-to-play games: include the ones the user has played (`include_played_free_games=1`) and document
        it.
  - [ ] A profile whose game details are private returns no games. Answer with a clear error that explains the
        Steam privacy setting ("Game details" must be Public), not an empty import.
- [ ] Matching Steam apps to IGDB: query IGDB `external_games` (Steam source, `uid` = the app ID) in batches through
      the IGDB adapter (FC-11). Cache the app ID → IGDB ID mapping, because it is the same for every user.
- [ ] Gateway routes, all behind `gatewayRoute` (auth + per-user limit), with contracts in `@fanste/core` and
      methods in `@fanste/api-client`:
  - [ ] `POST /api/steam/resolve`: pasted value → `{ steamId, personaName, avatarUrl }`
  - [ ] `POST /api/steam/library`: the user's owned games, each with its IGDB match (or none)
- [ ] Database (a migration, RLS: users see and change only their own rows):
  - [ ] `steam_links`: one per user (`steam_id`, `persona_name`, `avatar_url`, `linked_at`, `last_synced_at`).
  - [ ] `steam_library`: one row per owned app (`app_id`, `name`, `igdb_id` nullable, status `matched` /
        `unmatched` / `ignored` / `removed`, the collection item it created). This mirrors `scanned_files`
        (FC-21) and drives the review lists and re-syncs.
  - [ ] A new item source `steam`: the `collection_items.source` check, `ITEM_SOURCES` and the gallery's
        "Added" filter label.
- [ ] Import / sync in `@fanste/collection` (repository functions + hooks, like FC-23's `scan-matching.ts`):
  - [ ] Each matched game becomes an item with a copy: medium `Digital`, `storefront: 'Steam'`,
        `platform: 'PC (Microsoft Windows)'`, ownership `owned`, source `steam`.
  - [ ] An upsert, so a re-sync never duplicates.
  - [ ] Decide and document the case where the user already has a `Digital` copy of the game (e.g. bought on GOG):
        the one-copy-per-format constraint allows only one. For example, mark the app "already in collection"
        and leave the existing copy alone.
  - [ ] "Sync now" adds only new apps, and marks apps that are no longer owned as `removed`.
  - [ ] Large libraries (1000+ games) are processed in batches, with progress shown and the IGDB rate limit kept.
- [ ] UI (`apps/web`):
  - [ ] Settings → "Steam": paste field, "Linked to <persona>" with the avatar, "Sync now" with the last sync
        time, and "Unlink". Unlinking deletes the link and library rows but keeps the imported items.
  - [ ] Import summary: added / already in collection / no match / removed.
  - [ ] Review lists:
    - **No match:** search IGDB and pick the game (reuse the FC-24 Fix Match pieces), or ignore it.
    - **Removed from Steam:** remove the copy from the collection, or keep it.
- [ ] Unit tests with fixtures: profile/ID parsing, the Steam payload mappers, the IGDB `external_games` matching,
      and the sync plan (new / existing / removed apps).

## Acceptance criteria
- A user can link a Steam account by pasting their profile URL, custom name or SteamID64, in the browser and the
  desktop app, and sees which Steam account is linked.
- Importing a public library adds every matched game as "Digital · Steam · PC"; a second import adds nothing.
- After buying a new game on Steam, "Sync now" adds it; a game no longer owned shows up for confirmation and is not
  deleted automatically.
- A Steam game without an IGDB match can be matched by hand or ignored, and stays that way on the next sync.
- A private profile gets a message that explains how to make game details public.
- The Steam Web API key never reaches the browser (`pnpm check:bundle`).

## Notes
- Steam Web API terms: one key per app, about 100,000 calls a day. Don't imply that Valve endorses the app.
  Attribution goes with FC-27.
- Family Sharing games aren't owned, so `GetOwnedGames` doesn't return them.
- DLC isn't part of `GetOwnedGames` by default. Importing DLC (into a copy's `dlcNotes`) can be a follow-up.
- Linking through Steam sign-in (OpenID 2.0) would prove the user owns the account. It was left out by choice;
  the parsing step can later accept a signed-in SteamID too.
