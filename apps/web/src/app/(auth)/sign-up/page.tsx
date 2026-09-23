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

export const metadata: Metadata = { title: 'Sign up' };

// Placeholder form; FC-06 wires it to Supabase Auth.
export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Authentication arrives in FC-06.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input type="email" placeholder="Email" aria-label="Email" disabled />
        <Input type="password" placeholder="Password" aria-label="Password" disabled />
        <Button disabled>Sign up</Button>
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
