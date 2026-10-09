'use client';

import { useRouter } from 'next/navigation';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import type { Session, User } from '@fanste/supabase';

interface SessionContextValue {
  user: User | null;
  /** `null` while signed out, and during server rendering and hydration (see {@link useSession}). */
  session: Session | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  /** The user verified on the server for this request, so the first render already has it. */
  initialUser: User | null;
  children: ReactNode;
}

/**
 * Keeps the signed-in user available to Client Components and follows auth changes in this tab
 * (sign-in, sign-out, token refresh, profile updates). When the user signs out, the page is
 * refreshed so the proxy sends them to the sign-in page.
 */
export function SessionProvider({ initialUser, children }: SessionProviderProps) {
  const router = useRouter();
  const [value, setValue] = useState<SessionContextValue>({ user: initialUser, session: null });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setValue({ user: session?.user ?? null, session });
      if (event === 'SIGNED_OUT') router.refresh();
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return <SessionContext value={value}>{children}</SessionContext>;
}

function useSessionContext(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession() and useUser() must be used inside <SessionProvider>.');
  return value;
}

/** The signed-in user, or `null`. Available from the first render. */
export function useUser(): User | null {
  return useSessionContext().user;
}

/**
 * The current session (access token etc.), or `null`. It is read from the browser's cookies after
 * hydration, so it is `null` on the first render; prefer {@link useUser} for rendering.
 */
export function useSession(): Session | null {
  return useSessionContext().session;
}
