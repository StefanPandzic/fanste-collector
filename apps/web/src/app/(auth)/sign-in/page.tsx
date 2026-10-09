import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SignInForm } from '@/features/auth/auth-forms';
import { callbackErrorMessage } from '@/features/auth/errors';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === 'string' ? next : undefined;
  const errorMessage = callbackErrorMessage(typeof error === 'string' ? error : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to your collection.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
        <GoogleSignInButton next={nextPath} />
        <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>
        <SignInForm next={nextPath} />
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        No account?&nbsp;
        <Link href="/sign-up" className="text-foreground underline underline-offset-4">
          Sign up
        </Link>
      </CardFooter>
    </Card>
  );
}
