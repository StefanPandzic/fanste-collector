'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { CURRENCIES, DISPLAY_NAME_MAX_LENGTH, validateAvatarFile } from '@fanste/core';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FormMessage } from '@/features/auth/form-fields';
import type { FormState } from '@/features/auth/form-state';
import { useUser } from '@/features/auth/session-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { deleteAccount, removeAvatar, saveAvatar, updateProfile } from './actions';
import { AVATAR_BUCKET, newAvatarPath } from './avatar-path';
import { UserAvatar } from './user-avatar';

const INITIAL_STATE: FormState = {};

interface ProfileFormProps {
  displayName: string | null;
  defaultCurrency: string;
}

export function ProfileForm({ displayName, defaultCurrency }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL_STATE);
  const currencyErrors = state.fieldErrors?.defaultCurrency;

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        name="displayName"
        label="Display name"
        autoComplete="nickname"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        defaultValue={state.values?.displayName ?? displayName ?? ''}
        state={state}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultCurrency">Default currency</Label>
        <Select
          name="defaultCurrency"
          defaultValue={state.values?.defaultCurrency ?? defaultCurrency}
        >
          <SelectTrigger id="defaultCurrency" className="w-40" aria-invalid={!!currencyErrors}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Used for new prices and values in your collection.
        </p>
        {currencyErrors && <p className="text-sm text-destructive">{currencyErrors[0]}</p>}
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}

interface AvatarFormProps {
  name: string;
  avatarUrl: string | null;
}

/** Uploads the avatar straight to Storage from the browser, then saves its URL on the server. */
export function AvatarForm({ name, avatarUrl }: AvatarFormProps) {
  const user = useUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();
  const busy = uploading || removing;

  async function upload(file: File) {
    const problem = validateAvatarFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (!user) return;

    setUploading(true);
    try {
      const path = newAvatarPath(user.id, file.type);
      const { error } = await createSupabaseBrowserClient()
        .storage.from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
      if (error) {
        console.error('[profile] Avatar upload failed', error.message);
        toast.error('Could not upload the image. Please try again.');
        return;
      }
      notify(await saveAvatar(path));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} avatarUrl={avatarUrl} size="lg" className="size-16" />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload image'}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => startRemove(async () => notify(await removeAvatar()))}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">PNG, JPEG or WebP, up to 2 MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-label="Avatar image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}

function notify(state: FormState) {
  if (state.error) toast.error(state.error);
  else if (state.success) toast.success(state.success);
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, INITIAL_STATE);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="self-start">
          Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action} className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, your whole collection, tags and scanner data.
              It can&apos;t be undone. Export your collection first if you want to keep a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field
            name="confirm"
            label="Type DELETE to confirm"
            autoComplete="off"
            required
            state={state}
          />
          <FormMessage state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? 'Deleting…' : 'Delete account'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
