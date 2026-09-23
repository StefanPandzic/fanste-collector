import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv } from 'electron-vite';

import packageJson from './package.json' with { type: 'json' };

// The monorepo keeps its env files at the repository root (see `.env.example`).
const envDir = fileURLToPath(new URL('../..', import.meta.url));
// Only `DESKTOP_*` vars are inlined into the main process bundle (`import.meta.env.DESKTOP_*`).
const envPrefix = 'DESKTOP_';

export default defineConfig(({ mode }) => {
  if (mode === 'production' && !loadEnv(mode, envDir, envPrefix).DESKTOP_WEB_URL) {
    console.warn(
      '[desktop] DESKTOP_WEB_URL is not set; this build loads http://localhost:3000 (run `next start`).',
    );
  }

  return {
    // Only `dependencies` are externalized; everything in `devDependencies` (including the
    // @fanste/* TypeScript sources) is bundled, so the packaged app needs no node_modules.
    main: { envDir, envPrefix },
    preload: {
      define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
      },
      build: {
        rollupOptions: {
          // Sandboxed preload scripts can't be ES modules, and can't `require` other files, so
          // everything (including @fanste/* imports) is bundled into one CommonJS file.
          output: { format: 'cjs', entryFileNames: '[name].cjs' },
        },
      },
    },
  };
});
