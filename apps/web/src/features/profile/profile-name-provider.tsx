'use client';

import { createContext, use, type ReactNode } from 'react';

import { useUser } from '@/features/auth/session-provider';

import { displayName } from './display';

// The profile's display name for Client Components that print it, e.g. the PDF export's cover page
// (FC-26). The `(app)` layout loads the profile on the server and provides it.

const ProfileNameContext = createContext<string | null>(null);

export function ProfileNameProvider({
  profileName,
  children,
}: {
  profileName: string | null;
  children: ReactNode;
}) {
  return <ProfileNameContext value={profileName}>{children}</ProfileNameContext>;
}

/** The user's display name, else the part of their email before `@` (see `displayName`). */
export function useDisplayName(): string {
  const profileName = use(ProfileNameContext);
  return displayName(profileName, useUser()?.email);
}
