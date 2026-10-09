import { configDefaults, defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'collection',
    include: ['src/**/*.test.ts'],
    // Integration tests call the dev Supabase project; they run with `pnpm test:rls` only.
    exclude: [...configDefaults.exclude, 'src/**/*.integration.test.ts'],
  },
});
