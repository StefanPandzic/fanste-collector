'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { isDesktop } from '@/lib/platform';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { GENERIC_AUTH_ERROR } from './errors';
import { oauthRedirectUrl } from './oauth';
import { safeNextPath } from './routes';

/**
 * Starts Google sign-in (PKCE). The code verifier is stored in a cookie by the browser client, and
 * `/auth/callback` exchanges the returned code for a session.
 *
 * In the desktop app, Google sign-in must not run inside the app window, so the provider URL is
 * opened with `window.open`, which the desktop shell hands to the system browser. Google then
 * redirects to `fanste://auth/callback`, and the desktop app loads `/auth/callback` in its window.
 */
export function GoogleSignInButton({ next }: { next?: string | undefined }) {
  const [pending, setPending] = useState(false);
  const [waitingForBrowser, setWaitingForBrowser] = useState(false);

  async function signInWithGoogle() {
    setPending(true);
    const desktop = isDesktop();
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectUrl({
          origin: window.location.origin,
          next: safeNextPath(next),
          isDesktop: desktop,
        }),
        skipBrowserRedirect: desktop,
      },
    });

    if (error) {
      console.error('[auth] Google sign-in failed', error.code);
      toast.error(GENERIC_AUTH_ERROR);
      setPending(false);
      return;
    }
    if (desktop) {
      window.open(data.url, '_blank');
      setWaitingForBrowser(true);
      setPending(false);
    }
    // In the browser, the page is now navigating to Google; keep the button disabled.
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => void signInWithGoogle()}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
      {waitingForBrowser && (
        <p className="text-center text-sm text-muted-foreground" role="status">
          Finish signing in with Google in your browser. You will come back here automatically.
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
