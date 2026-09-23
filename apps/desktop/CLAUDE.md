# Desktop app (`apps/desktop`)

Instructions for the Electron shell. The repo-wide rules are in `../../CLAUDE.md`. For the web side of the bridge
(`useIsDesktop`, `<DesktopOnly>`), see `../web/CLAUDE.md`.

## Commands

```sh
pnpm dev:desktop                 # from root: Electron + web dev server (turbo `with: web#dev`)
pnpm --filter desktop build      # bundle main + preload to out/
pnpm --filter desktop preview    # run the built bundle
pnpm --filter desktop package    # installer via electron-builder (placeholder config, finalised in FC-29)
pnpm --filter desktop exec vitest run src/main/deep-link.test.ts
```

**Running from a VS Code extension terminal:** VS Code sets `ELECTRON_RUN_AS_NODE`, which makes Electron start as
plain Node.js. Unset it before `dev:desktop` or `preview`. In PowerShell, use
`Remove-Item Env:ELECTRON_RUN_AS_NODE`.

## Architecture

The app has no UI of its own. It is built with electron-vite, and its `BrowserWindow` loads the web app. In
production builds the URL is `DESKTOP_WEB_URL`; in development it is `http://localhost:3000`. Unpackaged builds
retry until the dev server is up (`main/window.ts`).

- `src/main/` is the main process:
  - `index.ts`: single-instance lock, deep links and app lifecycle
  - `window.ts`: window creation, and window position/size saved to `userData/window-state.json`
  - `security.ts`: navigation and permission lockdown
  - `ipc.ts`: bridge handlers
- `src/preload/index.ts` exposes `window.fanste`.
- `src/shared/` holds code used by both main and preload (IPC channel names, the OS mapping).

## Adding a bridge feature (`window.fanste`)

Change all four places:

1. **Contract:** extend `FansteDesktopBridge` in `packages/core/src/desktop-bridge.ts`. Only plain data and
   functions can cross the bridge, because values are structured-cloned.
2. **Channel:** add the name to `IpcChannel` in `src/shared/ipc-channels.ts`.
3. **Preload:** implement the method with `ipcRenderer.invoke`. Never expose `ipcRenderer` or the
   `IpcRendererEvent` to the renderer. For event subscriptions, wrap the listener and return an unsubscribe
   function, as `onScanProgress` does.
4. **Handler:** register it in `src/main/ipc.ts` with the local `handle()` wrapper, not `ipcMain.handle`
   directly. The wrapper rejects calls from frames outside the app origin. Validate the arguments in the handler,
   because they come from the renderer.

## Security model

The renderer is treated as a remote web page: `contextIsolation`, `sandbox`, `nodeIntegration: false`,
`webviewTag: false`, and DevTools only in unpackaged builds. Don't loosen these settings.

- `security.ts` keeps the window on the app origin. Other navigations and `window.open` open in the system
  browser, and only `http`, `https` and `mailto` URLs may open.
- Permissions outside a small allowlist are denied (`clipboard-sanitized-write`, `fullscreen`, for the app origin
  only).
- The rules themselves are pure functions in `main/url-policy.ts`. Change the rules there and apply them to
  Electron in `security.ts`.
- `DESKTOP_WEB_URL` must be `https:`; `http:` is allowed only for loopback addresses (`main/web-url.ts`). Its
  origin is the only one trusted by the window and the IPC handlers.
- Deep links use `fanste://`:
  - A second launch forwards its argv to the running instance.
  - macOS delivers the link through `open-url` instead.
  - FC-06 will use `fanste://auth/callback` for OAuth.
  - Never log deep-link query strings, because they can contain auth codes.
- Packaged builds set Electron fuses in `electron-builder.yml` (`runAsNode: false`, ASAR integrity, and others).
- `appId` in `electron-builder.yml` must match `APP_ID` in `main/index.ts`.

## Testing

Importing `electron` outside Electron fails, so Vitest covers only Electron-free modules: `url-policy`, `web-url`,
`deep-link`, `window-state` and `shared/platform`. When adding logic, put the decisions in a pure module with a
co-located `*.test.ts`, and keep the Electron wiring thin.

## Bundling and env

- electron-vite bundles main and preload, including the `@fanste/*` TypeScript sources, so the packaged app ships
  only `out/`. New packages therefore go in **`devDependencies`**; only unbundled native modules go in
  `dependencies`.
- The preload must be a single CommonJS file (`out/preload/index.cjs`), because sandboxed preloads can't be ES
  modules or `require` other files. Keep that `rollupOptions` output in `electron.vite.config.ts`.
- Only `DESKTOP_*` vars from the repo-root env files are inlined, at build time, as `import.meta.env.DESKTOP_*`.
  They end up in the shipped app, so they must never hold secrets. Declare new ones in `src/env.d.ts` and add them to
  the root `.env.example`.
- `__APP_VERSION__` (from `package.json`) is defined for the preload only.
