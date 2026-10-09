'use client';

import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/features/auth/actions';
import { useUser } from '@/features/auth/session-provider';
import { displayName } from '@/features/profile/display';
import { UserAvatar } from '@/features/profile/user-avatar';

interface UserMenuProps {
  profileName: string | null;
  avatarUrl: string | null;
}

/** Avatar button in the top bar with the account links and sign-out. */
export function UserMenu({ profileName, avatarUrl }: UserMenuProps) {
  const user = useUser();
  const [signingOut, startSignOut] = useTransition();
  const name = displayName(profileName, user?.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <UserAvatar name={name} avatarUrl={avatarUrl} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{name}</span>
          {user?.email && (
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOut())}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
