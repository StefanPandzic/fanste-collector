# FC-22 — Scanner: filename parser

**Phase:** 3 — Desktop Scanning · **Depends on:** FC-07 · **Platforms:** shared (`packages/core`, pure TS)

## Goal
Extract the likely title, year, format and TV episode info from file names and folder names using regex, e.g.
`Inception.2010.1080p.mkv` → `{ title: "Inception", year: 2010, resolution: "1080p" }` (SRS §3.2).

## Subtasks
- [ ] `parseMediaFilename(path: string): ParsedMedia` in `packages/core/src/scanner`
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
    confidence: number;   // 0–1, how sure the parser is
  }
  ```
- [ ] Rules:
  - [ ] Normalize separators (`.`, `_`, `-`) to spaces; strip extension
  - [ ] Year `(19|20)\d{2}` — the title is everything before the last plausible year
  - [ ] Strip quality/release tokens: resolution, codecs (x264, x265, HEVC), sources, audio (DTS, AAC, Atmos), release groups `[...]` / `-GROUP`
  - [ ] TV detection: `S01E02`, `1x02`, `Season 1/Episode 2` → `kind: 'tv'`, title = series name
  - [ ] Fall back to the parent folder name when the file name is generic (`movie.mkv`, `CD1`, `VIDEO_TS`)
  - [ ] Handle titles that contain numbers/years (`2001 A Space Odyssey 1968`, `Blade Runner 2049 (2017)`)
- [ ] Detect HDR tokens (`HDR`, `HDR10`, `HDR10+`, `DV`, `DoVi`)
- [ ] `toCopyDetails(parsed)` → FC-15 copy details: `format: 'Digital file'`, `details.resolution`, `details.hdr` (e.g. `2160p` + `DV` → 2160p, Dolby Vision)
- [ ] Table-driven unit tests with 50+ real-world filename samples

## Acceptance criteria
- ≥ 90% of the test fixture set parses to the expected title and year.
- Parser is pure (no Node APIs), so it can also be tested/used outside Electron.
