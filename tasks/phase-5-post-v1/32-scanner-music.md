# FC-32 — Scanner: music libraries (digital audio files)

**Phase:** 5 — Post-v1 follow-ups · **Depends on:** FC-10, FC-21, FC-22, FC-23, FC-24 · **Category:** `music` ·
**Platforms:** desktop

## Goal
Let the desktop scanner find the user's digital music (FLAC, MP3, …), group the files into albums and match
them to Discogs, the way it already does for movies and TV with TMDB. Music and video stay apart: the scanner
page has a **Movies & TV** tab and a **Music** tab, each with its own library folders, and a scan only ever
looks for one kind of file.

## Subtasks
- [ ] Scan kinds (`video` | `music`) in the bridge contract (`packages/core/src/desktop-bridge.ts`):
  - [ ] Library folders belong to one kind (`LibraryFolder.kind`); `selectDirectories(kind)` adds folders to
        that library. A folder can't be in both libraries (nor inside a folder of the other one)
  - [ ] `startScan({ kind, ... })` walks only that kind's folders and only its file types; the existing
        "one scan at a time" rule stays, so a video scan and a music scan never run together
  - [ ] Keep older desktop builds working: a bridge without `kind` means `video` (check before calling,
        like `probeFiles` in FC-22)
- [ ] Desktop (`apps/desktop/src/main/scanner/`):
  - [ ] `AUDIO_EXTENSIONS` next to `VIDEO_EXTENSIONS` (`.flac`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.opus`,
        `.wav`, `.aiff`, `.ape`, `.wv`, `.dsf`, …); skip cover images, cue sheets and logs; a much smaller
        minimum size than video (per kind, in `localStorage`)
  - [ ] Store the library kind with each folder (electron-store), migrate existing folders to `video`
  - [ ] `probeFiles` for audio: read the tags with mediainfo.js: artist, album artist, album, title, year,
        track / disc number, and when present barcode (UPC/EAN), catalog number and the Discogs /
        MusicBrainz release IDs; plus codec, bitrate, sample rate, bit depth and channels
  - [ ] IPC validation: a probed path must be an audio file inside a music library folder
- [ ] Database (migration + `pnpm db:types`):
  - [ ] `scanned_files.kind` (`video` | `music`, default `video` for existing rows), and the music tags in
        `media_info` (a typed shape in `packages/core/src/scanner/media-info.ts`)
  - [ ] Every scanner query and RPC filters by kind (`listScannedFiles`, `markScannedFilesRemoved`,
        `set_scan_matches`, `relink_scanned_files`, the review count for the nav badge)
- [ ] Album grouping (pure, in `packages/core/src/scanner/`): files become one album by (album artist,
      album) tags, falling back to the folder (and a `CD1` / `Disc 2` subfolder joins its parent). Tracks
      without album tags group by folder. One album → one collection item
- [ ] Matching (FC-23's runner, music branch):
  - [ ] Search Discogs' digital releases (`format=File`) first; when the album has no digital release, fall
        back to its master (`master:<id>`), or to its main release when it has no master (see Notes)
  - [ ] A barcode or catalog number tag → the exact Discogs lookup (`code`, FC-10); a Discogs release ID tag →
        that release directly; otherwise search by album artist + album (+ year)
  - [ ] Score candidates (`match-scoring.ts`): artist and title similarity, year, and the track count against
        the release's tracklist; auto-add / review / none like video
  - [ ] Pace for Discogs' 60 requests/min: far fewer titles per batch than TMDB, `Retry-After` and the
        gateway's `retry_later` respected; the run shows "x of y albums" and can be paused
  - [ ] A gateway matching route for Discogs candidates (like `POST /api/match/tmdb`), or reuse `/api/search`
        with the album's query, decided in the plan
- [ ] Copies: a matched album gets a `Digital` music copy (`source = 'scanner'`); add the digital audio fields
      to `MusicDetails` (file format such as FLAC / MP3, bitrate, sample rate, bit depth) and record the values
      read from the files in `file_details` so the item page shows "from file" (FC-23)
- [ ] Scanner page (`apps/web/src/features/scanner/`):
  - [ ] Tabs **Movies & TV** | **Music**; each has its own folders, Scan button, table, filters and match
        progress. Switching tabs is blocked (or the other tab shows "scan running") while a scan runs
  - [ ] Music table: one row per album (expandable to its tracks), Quality column = format / bit depth /
        sample rate (e.g. `FLAC 24/96`)
  - [ ] Fix Match for albums (FC-24's dialog): Discogs candidates with the pressing details from FC-10
        (`ReleaseDetails`), manual search with the music filters, ignore album / folder
- [ ] Unit tests: audio extensions and kind rules, tag parsing, album grouping, music match scoring, the
      kind filter in the repository functions

## Acceptance criteria
- The scanner page has separate Movies & TV and Music tabs and libraries; a scan of one tab never reports
  files of the other kind, and two scans can't run at the same time.
- Scanning a music folder of 50 albums (FLAC and MP3, with and without tags) groups the tracks into 50 albums
  and adds the confident matches as `Digital` music items, without rate-limit errors shown to the user.
- An album whose files carry a barcode tag is matched to exactly that Discogs release.
- Wrong or missing album matches can be fixed from the Music tab like video matches.
- Existing video libraries, scanned files and matches keep working after the upgrade.

## Notes
- Decided (2026-10-12): scanned music is digital. The matcher searches Discogs' digital releases first
  (`format=File`, `File` added to `MUSIC_SEARCH_FORMATS` for this) and links the album to that release. When
  Discogs has no digital release of the album, it falls back to the album's master (`master:<id>`, the
  album across all its pressings, which `getById` already loads), and to the album's main release when there
  is no master. A fallback match always goes to review instead of being auto-added. The copy's medium is
  always `Digital`.
- MusicBrainz identifies albums from audio files better (AcoustID fingerprints, release IDs in tags) and has
  no API key; a MusicBrainz → Discogs link (MusicBrainz release URLs often point to Discogs) could be a later
  improvement, not part of this task.
- Discogs' rate limit makes large music libraries slow to match (60 requests/min across all users of an
  instance); grouping by album keeps it to roughly one search per album.
