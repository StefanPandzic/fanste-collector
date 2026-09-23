# FC-29 — Production builds & release

**Phase:** 4 — Polish · **Depends on:** FC-28 · **Platforms:** web, desktop

## Goal
Deploy the web app/gateway against the production Supabase Cloud project and build desktop installers for Windows and
macOS (SRS §5 Phase 4, without mobile).

## Subtasks
### Supabase Cloud (production)
- [ ] Link the CLI to `fanste-collector-prod` and run `supabase db push` (no seed data)
- [ ] Auth settings: Site URL + redirect URLs for the production domain and `fanste://auth/callback`
- [ ] Google OAuth consent screen published (out of "testing" mode)
- [ ] Custom SMTP configured for production emails
- [ ] Keep-alive: scheduled ping (e.g. Vercel Cron) so the free-tier project doesn't pause

### Web + gateway
- [ ] Deploy `apps/web` to Vercel (or similar), production domain, all server env vars set (prod Supabase + provider keys)
- [ ] Error monitoring (e.g. Sentry free tier) for web and desktop

### Desktop (Electron)
- [ ] `electron-builder` config: Windows NSIS installer, macOS `.dmg` (universal: x64 + arm64)
- [ ] Production build points at the production web URL
- [ ] Code signing:
  - [ ] Windows: sign the installer if a certificate is available (otherwise document the SmartScreen warning)
  - [ ] macOS: Developer ID signing + notarization is **optional for v1** (needs a paid Apple Developer account); unsigned builds must be opened via right-click → Open — document this for testers
- [ ] Auto-update via `electron-updater` + GitHub Releases (Windows; macOS auto-update requires a signed app)

### CI/CD
- [ ] GitHub Actions: tag `v*` → build Windows and macOS installers and attach them to a GitHub Release
- [ ] Version bump script keeping `apps/*` versions in sync (`1.0.0`)
- [ ] `CHANGELOG.md` for 1.0.0

## Acceptance criteria
- Web app live on the production domain, using the production Supabase Cloud project.
- Windows and macOS installers install, sign in, sync and scan correctly.

## Out of scope for v1
- Mobile app builds and Google Play / Apple App Store publishing.
