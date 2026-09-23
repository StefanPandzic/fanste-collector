// Fails the build if this module is ever imported from a Client Component.
import 'server-only';

import { parseEnv, serverEnvSchema } from './schema';

/** Server-only env vars (API secrets). Use `clientEnv` from `./client` for `NEXT_PUBLIC_*` vars. */
export const serverEnv = parseEnv(serverEnvSchema, process.env, 'server');
