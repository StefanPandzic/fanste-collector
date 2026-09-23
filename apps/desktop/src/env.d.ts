/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** Web app URL loaded by the desktop window. Inlined at build time; see `.env.example`. */
  readonly DESKTOP_WEB_URL?: string;
}

/** `version` from `apps/desktop/package.json`, inlined into the preload script at build time. */
declare const __APP_VERSION__: string;
