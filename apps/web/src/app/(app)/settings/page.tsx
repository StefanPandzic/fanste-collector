import { APP_NAME } from '@fanste/core';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/features/auth/session';
import { displayName } from '@/features/profile/display';
import { getProfile } from '@/features/profile/queries';
import { AvatarForm, DeleteAccountForm, ProfileForm } from '@/features/profile/settings-forms';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const name = displayName(profile?.display_name, user.email);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your profile and account.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear in the app.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <AvatarForm name={name} avatarUrl={profile?.avatar_url ?? null} />
          <ProfileForm
            displayName={profile?.display_name ?? null}
            defaultCurrency={profile?.default_currency ?? 'EUR'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as {user.email}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Deleting your account removes all of your data from {APP_NAME}.
          </p>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
