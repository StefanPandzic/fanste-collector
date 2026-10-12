# FC-31 — Connect your Discogs account (OAuth + collection sync)

**Phase:** 5 — Post-v1 follow-ups · **Depends on:** FC-10, FC-14 · **Category:** `music` · **Platforms:** web,
desktop

## Goal
Let each user connect their own Discogs account to Fanste Collector, import their Discogs collection, and keep
music items in sync both ways. Split out of FC-10, which only uses the app's own credentials for search and
metadata.

## Subtasks
- [ ] OAuth 1.0a flow through the API gateway, signed with the app's Consumer Key + Secret from FC-10 (the secret
      never reaches the client):
  - [ ] `/api/discogs/connect`: get a request token, redirect to Discogs' authorize page
  - [ ] `/api/discogs/callback`: exchange the verifier for the user's access token + secret, read
        `/oauth/identity` for the Discogs username
  - [ ] Desktop: open the authorize URL in the system browser and return through the web callback or a
        `fanste://` deep link (see `apps/desktop/CLAUDE.md`)
- [ ] Token storage: a migration for a per-user connection (Discogs username, access token + secret, connected at,
      last sync). Tokens encrypted at rest and readable only by server code (no RLS select for the browser); the
      client sees only "connected as <username>"
- [ ] "Connect Discogs" / "Disconnect" in the user's settings; disconnect deletes the stored tokens
- [ ] Import: page through `/users/{username}/collection/folders/0/releases` and add each release as a music
      item with a copy (`addItem`, upsert so a re-import never duplicates); map the Discogs folder, media/sleeve
      condition and notes fields onto the FC-10 `MusicDetails`
- [ ] Push: adding or removing a Discogs-backed copy in Fanste adds it to / removes it from the user's Discogs
      collection (`POST`/`DELETE` on the folder's releases); store the Discogs `instance_id` on the copy
- [ ] Pull: Discogs has no webhooks, so re-sync on demand ("Sync now") and on sign-in, at most every N minutes
- [ ] Conflict rule (decide and document): e.g. last change wins per field, deletions on either side need
      confirmation
- [ ] Respect the Discogs rate limit (FC-08 throttle, shared with FC-10's requests); large imports run as a
      queued background job with progress
- [ ] Optional: import/sync the wantlist (`/users/{username}/wants`)
- [ ] Price guide (moved here from FC-10): show Discogs' suggested price per condition
      (`/marketplace/price_suggestions/{release_id}`, which answers 401 without the user's own OAuth
      token) on the item page and in the add dialog, in the user's Discogs currency; optionally offer it
      as the copy's estimated value for the copy's media condition. `/marketplace/stats/{release_id}`
      (lowest listed price + number for sale) is public but was left out of FC-10 by choice
- [ ] Unit tests for the mapping and the sync plan, with fixtures

## Acceptance criteria
- A user can connect their Discogs account from the browser and the desktop app, and sees which Discogs user is
  connected.
- Importing a Discogs collection of 200 releases adds 200 music items without duplicates on a second import and
  without rate-limit errors shown to the user.
- Adding a release in Fanste shows up in the user's Discogs collection, and a release added on discogs.com shows
  up in Fanste after a sync.
- Disconnecting removes the stored tokens; no other user can ever read them.

## Notes
- A personal access token only ever acts as the account that created it, so it can't be used for other users.
- Discogs API terms apply: attribution (FC-27) and the `User-Agent` requirement from FC-10.
