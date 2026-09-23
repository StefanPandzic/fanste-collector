# FC-03 — Desktop shell (Electron)

**Phase:** 1 — Foundation · **Depends on:** FC-02 · **Platforms:** Windows, macOS

## Goal
Create `apps/desktop`: an Electron shell that loads the Next.js web app and exposes a small, secure bridge for
desktop-only features (local file scanning, SRS §3.2).

## Subtasks
- [x] Create `apps/desktop` (Electron + TypeScript; build with `electron-vite` or `tsup`)
- [x] Main process:
  - [x] Create window; load `http://localhost:3000` in dev and the production web URL in prod (configurable via env)
  - [x] Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, restrict navigation to the app origin, open external links in the system browser
  - [x] Single-instance lock, window state persistence
  - [x] Register `fanste://` protocol handler (needed for OAuth callback in FC-06)
- [x] Preload script exposing `window.fanste` via `contextBridge`:
  - [x] `platform` info (`os`, app version)
  - [x] Stub `scanner` API (implemented in FC-21): `selectDirectories()`, `startScan()`, `onScanProgress()`
- [x] Shared TypeScript type for the bridge in `packages/core` (`FansteDesktopBridge`) so the web app can use it type-safely
- [x] Dev script that starts web + desktop together via Turborepo
- [x] Packaging config placeholder (`electron-builder.yml`) — finalised in FC-29

## Acceptance criteria
- `pnpm dev:desktop` opens a desktop window showing the web app.
- `window.fanste` exists in the renderer inside Electron and is `undefined` in a normal browser.
- No Node APIs are reachable from the renderer.

## Notes
- **Decision:** loading the hosted web app keeps one UI codebase and keeps Next.js API routes working. Offline
  desktop mode is out of scope for v1.

### Implementation notes
- **Versions:** Electron 44 (Node 24, Chromium 152), electron-vite 5 with Vite 7 (electron-vite 5 doesn't support
  Vite 8 yet), electron-builder 26.15 (the npm `latest` tag).
- **Build:** electron-vite bundles `src/main` (ESM, `out/main/index.js`) and `src/preload` (CommonJS,
  `out/preload/index.cjs`, because sandboxed preloads can't be ES modules). Only `dependencies` are externalized, so
  everything, including the `@fanste/*` TypeScript sources, lives in `devDependencies` and gets bundled. The packaged
  app contains no `node_modules`.
- **Web URL:** `DESKTOP_WEB_URL` (root env files or shell) is inlined at build time. It defaults to
  `http://localhost:3000` and must be `https:` except for loopback hosts. A production build without it logs a
  warning and loads localhost (useful with `next start` + `pnpm --filter desktop preview`); FC-29 sets it.
- **Dev:** `pnpm dev:desktop` = `turbo run dev --filter=desktop`; `apps/desktop/turbo.json` runs `web#dev` alongside
  (`with`). Unpackaged builds retry loading while the dev server isn't up yet.
- **Security:**
  - Navigation away from the app origin (`will-navigate`, main-frame `will-redirect`), `window.open` and
    `target=_blank` open in the system browser. Only `http:`, `https:` and `mailto:` URLs are handed to the OS.
  - All permissions are denied except `clipboard-sanitized-write` and `fullscreen` for the app origin.
  - IPC handlers reject calls from frames outside the app origin.
  - `webviewTag` is off, and DevTools are disabled in packaged builds.
  - `electron-builder.yml` flips the Electron fuses: no `RunAsNode`, no `NODE_OPTIONS` or inspect flags, asar-only
    loading with integrity validation, and cookie encryption.
- **Verified:** in the dev window, `window.fanste` exposes `platform` and `scanner` and is frozen; `require`, `process`,
  `module` and `Buffer` are undefined; the scanner stubs reject with "not implemented yet (FC-21)". External navigations
  are routed to `shell.openExternal`, and a second instance forwards its `fanste://` argv to the running one.
  `electron-builder --dir` produces a working `Fanste Collector.exe` with the fuses applied.
- **Deep links:** `fanste://` is registered on every launch (in dev with the app path, so Windows can relaunch
  `electron <app dir> <url>`). Links arrive via `second-instance` / launch argv (Windows) or `open-url` (macOS). For
  now they only focus the window and log the path (never the query, which will hold the OAuth code); FC-06 forwards
  them to the renderer.
- **Window state:** bounds and maximized state are saved to `<userData>/window-state.json` on close and ignored if
  the saved position is no longer on any display. `productName` in `package.json` makes `userData`
  `%APPDATA%\Fanste Collector` / `~/Library/Application Support/Fanste Collector`.
- **App ID:** `com.fanste.collector` (electron-builder `appId` and the Windows AppUserModelID). Change both together.
- **Install scripts:** `electron` is allowed to run its postinstall (downloads the binary); CI skips it with
  `ELECTRON_SKIP_BINARY_DOWNLOAD=1` since it never launches Electron. `esbuild` and `electron-winstaller` (Squirrel
  only; we build NSIS) stay blocked.
- **Tests:** Vitest covers the Electron-free modules (URL policy, deep-link parsing, web URL, window state, OS mapping).
  An Electron smoke test with Playwright comes in FC-28.
- **Gotcha:** VS Code sets `ELECTRON_RUN_AS_NODE=1` for extension-host processes (e.g. coding agents). With it
  set, `electron` starts as plain Node and fails with "does not provide an export named 'BrowserWindow'". Unset it.
  The integrated terminal isn't affected, and neither are packaged builds (`RunAsNode` fuse).
- **Left for later:** app icon and branding (FC-27), app menu, error page when the web app is unreachable (FC-28),
  code signing and auto-update (FC-29).
