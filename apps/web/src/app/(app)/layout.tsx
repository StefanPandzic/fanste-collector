import { AppShell } from '@/components/app-shell/app-shell';
import { requireUser } from '@/features/auth/session';
import { SessionProvider } from '@/features/auth/session-provider';
import { AppCollectionProvider } from '@/features/collection/collection-provider';
import { getProfile } from '@/features/profile/queries';

import type { ReactNode } from 'react';

// Authenticated pages. The proxy already redirects signed-out users; this check is the second line
// of defense and loads the user and profile for the shell.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <SessionProvider initialUser={user}>
      <AppCollectionProvider>
        <AppShell
          profileName={profile?.display_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        >
          {children}
        </AppShell>
      </AppCollectionProvider>
    </SessionProvider>
  );
}
