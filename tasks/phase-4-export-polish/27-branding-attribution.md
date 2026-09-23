# FC-27 — Branding & provider attribution

**Phase:** 4 — Polish · **Depends on:** FC-16 · **Platforms:** web, desktop

## Goal
Finalize the Fanste Collector brand assets and meet each data provider's attribution requirements (SRS §4: TMDB
requires a developer attribution logo).

## Subtasks
- [ ] Logo + wordmark (SVG), app icon sets:
  - [ ] Web: favicon, `apple-touch-icon`, PWA manifest icons, Open Graph image
  - [ ] Desktop: `.ico` (Windows), `.icns` (macOS), installer artwork, splash/loading screen while the web app loads
- [ ] About / Credits screen (web and desktop):
  - [ ] TMDB logo + "This product uses the TMDB API but is not endorsed or certified by TMDB."
  - [ ] "Data provided by Discogs" with link
  - [ ] IGDB / Twitch credit
  - [ ] "Powered by BoardGameGeek" logo with link
- [ ] Provider attribution on item detail pages (source badge + link)
- [ ] Legal pages: Privacy Policy and Terms (needed for the Google OAuth consent screen)
- [ ] App name "Fanste Collector" used consistently (window title, page metadata, installers, emails)

## Acceptance criteria
- All provider attribution requirements are satisfied and checked against each provider's current terms.
- Icons render correctly in browsers, on Windows and on macOS (no default Next.js/Electron icons left).
