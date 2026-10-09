import { defineConfig } from 'vitest/config';

// Integration tests of the repository against the dev Supabase Cloud project (FC-14). Run them from
// the repo root with `pnpm test:rls` (scripts/test-rls.mjs), which loads the root `.env*` files first.
export default defineConfig({
  test: {
    name: 'collection-integration',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
