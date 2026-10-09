import react from '@fanste/config/eslint/react';

// The preset applies the React Hooks rules to `.tsx` files only; the hooks here live in `.ts` files.
const hooksConfig = react.find((config) => config.plugins?.['react-hooks']);

export default [...react, { ...hooksConfig, files: ['src/react/**/*.ts'] }];
