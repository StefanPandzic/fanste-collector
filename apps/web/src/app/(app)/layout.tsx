import { AppShell } from '@/components/app-shell/app-shell';

import type { ReactNode } from 'react';

// Authenticated pages. FC-06 adds the session check that redirects signed-out users to /sign-in.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
