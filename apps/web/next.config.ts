import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv as parseDotenv } from 'node:util';

import packageJson from './package.json' with { type: 'json' };
import { clientEnvSchema, parseEnv, serverEnvSchema } from './src/env/schema';

import type { NextConfig } from 'next';

/**
 * The monorepo keeps its env files at the repository root (see `.env.example`), but Next.js only
 * reads them from the app directory. Load the root files with the same precedence Next.js uses.
 * Variables that are already set (shell, CI, hosting, `apps/web/.env*`) are never overridden.
 * The repo tooling loads the same files in `scripts/lib/root-env.mjs`; keep the two in sync.
 */
function loadRootEnvFiles() {
  const root = path.resolve(import.meta.dirname, '../..');
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const files = [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'];

  for (const file of files) {
    const filePath = path.join(root, file);
    if (!existsSync(filePath)) continue;
    for (const [key, value] of Object.entries(parseDotenv(readFileSync(filePath, 'utf8')))) {
      process.env[key] ??= value;
    }
  }
}

loadRootEnvFiles();

// Fail fast on malformed values instead of on first use.
parseEnv(clientEnvSchema, process.env, 'client');
parseEnv(serverEnvSchema, process.env, 'server');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Type-checks `<Link href>` and `router.push()` against the app's routes.
  typedRoutes: true,
  // Workspace packages ship TypeScript source, so Next.js compiles them. Derived from
  // package.json so new `@fanste/*` dependencies are picked up automatically.
  transpilePackages: Object.keys(packageJson.dependencies).filter((name) =>
    name.startsWith('@fanste/'),
  ),
  images: {
    // Cover art from the metadata providers (FC-09 – FC-12).
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' },
      { protocol: 'https', hostname: 'i.discogs.com' },
      { protocol: 'https', hostname: 'images.igdb.com', pathname: '/igdb/image/upload/**' },
      { protocol: 'https', hostname: 'cf.geekdo-images.com' },
    ],
  },
};

export default nextConfig;
