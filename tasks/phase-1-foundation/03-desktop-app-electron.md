# FC-03 — Desktop shell (Electron)

**Phase:** 1 — Foundation · **Depends on:** FC-02 · **Platforms:** Windows, macOS

## Goal
Create `apps/desktop`: an Electron shell that loads the Next.js web app and exposes a small, secure bridge for
desktop-only features (local file scanning, SRS §3.2).

## Subtasks
- [ ] Create `apps/desktop` (Electron + TypeScript; build with `electron-vite` or `tsup`)
- [ ] Main process:
  - [ ] Create window; load `http://localhost:3000` in dev and the production web URL in prod (configurable via env)
  - [ ] Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, restrict navigation to the app origin, open external links in the system browser
  - [ ] Single-instance lock, window state persistence
  - [ ] Register `fanste://` protocol handler (needed for OAuth callback in FC-06)
- [ ] Preload script exposing `window.fanste` via `contextBridge`:
  - [ ] `platform` info (`os`, app version)
  - [ ] Stub `scanner` API (implemented in FC-21): `selectDirectories()`, `startScan()`, `onScanProgress()`
- [ ] Shared TypeScript type for the bridge in `packages/core` (`FansteDesktopBridge`) so the web app can use it type-safely
- [ ] Dev script that starts web + desktop together via Turborepo
- [ ] Packaging config placeholder (`electron-builder.yml`) — finalised in FC-29

## Acceptance criteria
- `pnpm dev:desktop` opens a desktop window showing the web app.
- `window.fanste` exists in the renderer inside Electron and is `undefined` in a normal browser.
- No Node APIs are reachable from the renderer.

## Notes
- **Decision:** loading the hosted web app keeps one UI codebase and keeps Next.js API routes working. Offline
  desktop mode is out of scope for v1.
