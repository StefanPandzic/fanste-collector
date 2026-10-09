'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { createApiClient } from '@fanste/api-client';
import { CollectionProvider, collectionErrorMessage } from '@fanste/collection';

import { useUser } from '@/features/auth/session-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { CollectionError } from '@fanste/collection';

// Module scope, so the provider's context value stays stable across renders.
function showError(error: CollectionError) {
  toast.error(collectionErrorMessage(error));
}

/**
 * Connects the collection hooks (`@fanste/collection`) to this app: the browser Supabase client, the
 * gateway on the same origin (session cookies), toasts for failed changes, and Realtime sync. Lives
 * in the `(app)` layout, inside `SessionProvider`.
 */
export function AppCollectionProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  // The hooks read the clients during render, so they exist from the first render. During server
  // rendering this builds an unused client (no session refresh, no Realtime connection): the hooks
  // only fetch and subscribe in the browser.
  const [clients] = useState(() => ({
    supabase: createSupabaseBrowserClient(),
    api: createApiClient({ baseUrl: '' }),
  }));

  // The layout requires a user. After sign-out, render nothing until the refresh reaches the sign-in
  // page: the pages below use the collection hooks, which need the provider.
  if (!user) return null;

  return (
    <CollectionProvider
      client={clients.supabase}
      api={clients.api}
      userId={user.id}
      onError={showError}
    >
      {children}
    </CollectionProvider>
  );
}
