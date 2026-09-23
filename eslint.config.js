// Lints root-level files only; each workspace package has its own eslint.config.js.
import base from '@fanste/config/eslint/base';

export default [{ ignores: ['apps/**', 'packages/**'] }, ...base];
