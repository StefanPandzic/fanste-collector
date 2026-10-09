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
import { SignUpForm } from '@/features/auth/auth-forms';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Track your whole collection in one place.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <GoogleSignInButton />
        <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
          <Separator className="flex-1" />
          or
          <Separator className="flex-1" />
        </div>
        <SignUpForm />
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href="/sign-in" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
