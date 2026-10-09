'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { PASSWORD_MIN_LENGTH } from '@fanste/core';

import { Button } from '@/components/ui/button';

import { requestPasswordReset, signIn, signUp, updatePassword } from './actions';
import { Field, FormMessage } from './form-fields';

import type { FormState } from './form-state';

const INITIAL_STATE: FormState = {};

export function SignInForm({ next }: { next?: string | undefined }) {
  const [state, action, pending] = useActionState(signIn, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        state={state}
      />
      <div className="flex flex-col gap-1.5">
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          state={state}
        />
        <Link
          href="/forgot-password"
          className="self-end text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, INITIAL_STATE);
  if (state.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        state={state}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
        state={state}
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, INITIAL_STATE);
  if (state.success) return <FormMessage state={state} />;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        state={state}
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
        state={state}
      />
      <Field
        name="confirmPassword"
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        required
        state={state}
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
