import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'export',
    include: ['src/**/*.test.ts'],
  },
});
