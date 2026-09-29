import { defineConfig } from 'vitest/config';

// Integration tests against the dev Supabase Cloud project (FC-05). Run them from the repo root with
// `pnpm test:rls` (scripts/test-rls.mjs), which loads the root `.env*` files first.
export default defineConfig({
  test: {
    name: 'supabase-integration',
    include: ['src/**/*.integration.test.ts'],
    // Every test is a round trip to the cloud project; setup also creates and signs in two users.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
