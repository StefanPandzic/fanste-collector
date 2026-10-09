import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ResetPasswordForm } from '@/features/auth/auth-forms';
import { getCurrentUser, hasRecoverySession } from '@/features/auth/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reset password' };

/**
 * Opened from the password reset email: `/auth/confirm` has already signed the user in with the
 * link's token. Without such a recent recovery session the link was invalid or has expired; a normal
 * sign-in doesn't allow setting a password here.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user || !(await hasRecoverySession())) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
          <CardDescription>
            This password reset link is invalid or has expired. Request a new one.
          </CardDescription>
        </CardHeader>
        <CardFooter className="text-sm">
          <Link href="/forgot-password" className="underline underline-offset-4">
            Request a new link
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>For {user.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
