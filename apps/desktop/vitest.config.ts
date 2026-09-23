import { defineProject } from 'vitest/config';

// Tests cover the Electron-free modules only: importing `electron` outside Electron fails.
export default defineProject({
  test: {
    name: 'desktop',
    include: ['src/**/*.test.ts'],
  },
});
