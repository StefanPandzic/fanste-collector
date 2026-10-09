import 'server-only';

import { createSupabaseServerClient, createSupabaseTokenClient } from '@/lib/supabase/server';

import { bearerToken } from './bearer';

import type { NextRequest } from 'next/server';

/**
 * The verified user ID of a gateway request, or `null`. A future mobile app sends
 * `Authorization: Bearer <access token>`; the web and desktop apps send the session cookies.
 * A bearer header wins over cookies, and an invalid one is rejected rather than ignored.
 */
export async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const token = bearerToken(request.headers.get('authorization'));
  if (token === undefined) return null;

  const supabase = token ? createSupabaseTokenClient() : await createSupabaseServerClient();
  try {
    // Verifies the signature and expiry (locally with asymmetric keys, otherwise with the Auth
    // server). It throws, rather than returning an error, on a token it can't decode.
    const { data, error } = await supabase.auth.getClaims(token ?? undefined);
    if (error || !data) return null;
    return data.claims.sub || null;
  } catch {
    return null;
  }
}
