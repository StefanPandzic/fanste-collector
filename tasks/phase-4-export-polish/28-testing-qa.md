# FC-28 — Testing & cross-platform QA

**Phase:** 4 — Polish · **Depends on:** Phase 3 complete · **Platforms:** web, desktop

## Goal
Make sure v1.0 works reliably in the browser and in the desktop app on Windows and macOS, including responsive
layouts (SRS §5 Phase 4).

## Subtasks
### Automated
- [ ] Unit coverage for `packages/core` (models, parser), `packages/export`, provider mappers — target ≥ 80% lines
- [ ] Gateway integration tests with mocked providers (success, 429, 5xx, malformed XML)
- [ ] RLS integration tests against the dev Supabase Cloud project (from FC-05)
- [ ] Playwright e2e (web): sign up → search → add → edit → filter → export CSV → delete
- [ ] Electron smoke test (Playwright `_electron`): app launches, signs in, scanner page is visible

### Manual QA checklist
- [ ] Auth: email and Google in the browser and the desktop app; password reset; sign-out; session expiry
- [ ] Realtime sync: add an item in the browser → visible in the desktop app, and vice versa
- [ ] Every category: search, add, detail, edit, delete
- [ ] Scanner on Windows **and** macOS: paths with spaces/unicode, network drives, 5k+ files, re-scan, Fix Match
- [ ] Exports: CSV in Excel/Sheets; PDF grid + insurance list on A4/Letter
- [ ] Browsers: Chrome, Firefox, Safari, Edge (latest)
- [ ] Responsive: narrow window (~768 px), 1280 px and 1920 px; light and dark mode
- [ ] Offline / bad network: clear error states, no data loss
- [ ] Rate limits: bulk scan and big gallery don't trigger provider blocks

### Fixing
- [ ] Log bugs as GitHub issues labelled `v1-bug`, fix every P0/P1 before release

## Acceptance criteria
- CI green; e2e suite passes.
- Manual checklist signed off for web, Windows and macOS with no open P0/P1 bugs.
