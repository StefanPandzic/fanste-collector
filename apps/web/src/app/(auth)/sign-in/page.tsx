import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

// Placeholder form; FC-06 wires it to Supabase Auth.
export default function SignInPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Authentication arrives in FC-06.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input type="email" placeholder="Email" aria-label="Email" disabled />
        <Input type="password" placeholder="Password" aria-label="Password" disabled />
        <Button disabled>Sign in</Button>
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
