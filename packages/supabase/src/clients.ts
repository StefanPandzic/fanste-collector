import {
  createBrowserClient as createSsrBrowserClient,
  createServerClient as createSsrServerClient,
} from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

import type { SupabasePublicConfig, SupabaseServiceConfig } from './config';
import type { Database } from './database.types';
import type { CookieMethodsServer } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Supabase client typed with the generated schema of the `public` schema. */
export type FansteSupabaseClient = SupabaseClient<Database>;

/**
 * Cookie access for the server client, supplied by the framework (e.g. Next.js `cookies()`), so this
 * package stays framework-free. `setAll` may be omitted where cookies can't be written; the client
 * then can't persist refreshed sessions.
 */
export type SupabaseCookieMethods = Pick<CookieMethodsServer, 'getAll' | 'setAll'>;

/**
 * Client for browser code. It keeps the session in cookies (so the server client sees it too) and
 * is a singleton per page. Access is limited by RLS to the signed-in user.
 */
export function createBrowserClient({
  url,
  publishableKey,
}: SupabasePublicConfig): FansteSupabaseClient {
  return createSsrBrowserClient<Database>(url, publishableKey);
}

/**
 * Client for server code that acts as the signed-in user (Server Components, Route Handlers, Server
 * Functions). It reads the session from the request cookies. Create one per request.
 */
export function createServerClient(
  { url, publishableKey }: SupabasePublicConfig,
  cookies: SupabaseCookieMethods,
): FansteSupabaseClient {
  return createSsrServerClient<Database>(url, publishableKey, { cookies });
}

/**
 * Client with the secret key, which **bypasses RLS**. Server-only: use it for trusted writes such as
 * the metadata cache (FC-08), never for requests on behalf of a user. It has no session.
 */
export function createServiceClient({
  url,
  secretKey,
}: SupabaseServiceConfig): FansteSupabaseClient {
  if ('window' in globalThis) {
    throw new Error('createServiceClient() must never run in a browser: it uses the secret key.');
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
