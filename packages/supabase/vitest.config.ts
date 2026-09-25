import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'supabase',
    include: ['src/**/*.test.ts'],
  },
});
