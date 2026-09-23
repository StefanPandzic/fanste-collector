import { defineConfig } from 'vitest/config';

// Used by `pnpm test:watch` to run every project from the root.
// CI runs `pnpm test`, which goes through Turborepo and each package's own `vitest run`.
export default defineConfig({
  test: {
    projects: ['{apps,packages}/*/vitest.config.ts'],
  },
});
