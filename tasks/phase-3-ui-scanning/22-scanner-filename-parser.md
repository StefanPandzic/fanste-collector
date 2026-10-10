# FC-22 — Scanner: filename parser

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-07 · **Platforms:** shared (`packages/core`, pure TS)

## Goal
Extract the likely title, year, format and TV episode info from file names and folder names using regex, e.g.
`Inception.2010.1080p.mkv` → `{ title: "Inception", year: 2010, resolution: "1080p" }` (SRS §3.2).

## Subtasks
- [x] `parseMediaFilename(path: string): ParsedMedia` in `packages/core/src/scanner`
  ```ts
  interface ParsedMedia {
    kind: 'movie' | 'tv' | 'unknown';
    title: string | null;
    year?: number;
    season?: number;
    episode?: number;
    resolution?: '480p' | '720p' | '1080p' | '2160p';
    hdr?: 'HDR10' | 'HDR10+' | 'Dolby Vision';
    source?: string;      // BluRay, WEB-DL, DVDRip, REMUX, ...
    audioChannels?: string; // 2.0, 5.1, 7.1 (from DD5.1, DDP5.1, AAC2.0, TrueHD.7.1, ...)
    fileFormat?: string;  // from the extension: MKV, MP4, AVI, ...; ISO / VIDEO_TS / BDMV for disc images
    confidence: number;   // 0–1, how sure the parser is
  }
  ```
- [x] Rules:
  - [x] Normalize separators (`.`, `_`, `-`) to spaces; strip extension
  - [x] Year `(19|20)\d{2}` — the title is everything before the last plausible year
  - [x] Strip quality/release tokens: resolution, codecs (x264, x265, HEVC), sources, audio (DTS, AAC, Atmos), release groups `[...]` / `-GROUP`
  - [x] TV detection: `S01E02`, `1x02`, `Season 1/Episode 2` → `kind: 'tv'`, title = series name
  - [x] Fall back to the parent folder name when the file name is generic (`movie.mkv`, `CD1`, `VIDEO_TS`)
  - [x] Handle titles that contain numbers/years (`2001 A Space Odyssey 1968`, `Blade Runner 2049 (2017)`)
- [x] Detect HDR tokens (`HDR`, `HDR10`, `HDR10+`, `DV`, `DoVi`)
- [x] `toCopyDetails(parsed)` → FC-15 copy details: `format: 'Digital file'`, `details.fileFormat`, `details.resolution`, `details.hdr`, `details.audioChannels` (e.g. `2160p` + `DV` → 2160p, Dolby Vision)
- [x] Table-driven unit tests with 50+ real-world filename samples

## Acceptance criteria
- ≥ 90% of the test fixture set parses to the expected title and year.
- Parser is pure (no Node APIs), so it can also be tested/used outside Electron.

### Implementation notes
- **Parser** (`packages/core/src/scanner/filename-parser.ts`): the title ends at the first episode
  marker, release year or quality token; the year is the _last_ plausible one before that, never the
  first word (`2001 A Space Odyssey 1968`, `Blade Runner 2049 (2017)`, `1917 (2019)`). Years after
  next year don't count (`maxYear`), so `Blade Runner 2049.mkv` keeps 2049 in the title. A hyphen
  between letters stays (`Spider-Man`, `WALL-E`). Generic names (`movie`, `CD1`, `VTS_01_1`, `00001`)
  and TV names without a title (`S03E04.mkv`) take the nearest folder that isn't a grouping folder
  (`Season 1`, `BDMV`, `STREAM`, `CD1`, `Movies`). A folder with the same title gives the year
  (`Inception (2010)/Inception.mkv`). `Season 2/Episode 5.mkv` is TV too. `resolution` also allows
  `576p` (it is in `RESOLUTIONS`). The 60-name fixture parses 100% to the expected title and year.
- **Media info from the file itself** (beyond the task, agreed): the desktop app reads each new or
  changed file's headers with mediainfo.js (MediaInfoLib as WebAssembly, BSD-2, ~2.5 MB) on a worker
  thread: container, resolution (from the frame size), HDR (Dolby Vision / HDR10+ / HDR10, `none` for
  SDR), the default audio track's channels, and the audio and embedded subtitle languages. It reads
  only a few MB per file (a 4K 800 MB MP4 took ~80 ms). Stored in `scanned_files.media_info`
  (migration `20261010133520_scanner_media_info.sql`): `null` = not read yet, `{}` = nothing found.
  `toCopyDetails(parsed, mediaInfo, sidecarSubtitleLanguages)` lets the headers win and the name fill
  the gaps; sidecar subtitle languages come first.
- **Bridge:** `probeFiles(paths)` (≤ `MAX_PROBE_FILES` = 50), each path canonicalized and checked to be
  a video inside a library folder (others get `null` without being read). `mediaInfo: null` means the
  file couldn't be read; it stays unread and is tried after the next scan. Each request times out
  after 30 s per file (the worker is restarted), and Stop on the page doesn't wait for a hung read.
  A home folder (`/Users/<name>`, `/home/<name>`) and mount points never give the title.
- **Writes:** each upsert row carries `parsed_title` / `parsed_year` / `parsed_format`, and a changed
  file gets `media_info = null`. A known file whose stored parse differs from the current parser is
  rewritten too, which backfilled the FC-21 rows and picks up future parser fixes.
- **Scanner page:** after a scan, the files without media info are read in batches of 20 with a
  progress line and a Stop button; the results table has a Quality column.
- Not done: `source` is parser-only (no copy-detail field); Atmos / `7.1.4` can't be told from the
  channel count; disc folders (ISO, VIDEO_TS) are parsed but not collected by the FC-21 walk.
