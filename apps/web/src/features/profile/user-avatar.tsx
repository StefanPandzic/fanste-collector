import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { initials } from './display';

import type { ComponentProps } from 'react';

interface UserAvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: ComponentProps<typeof Avatar>['size'];
  className?: string;
}

/** The user's avatar image, or their initials while it loads or when there is none. */
export function UserAvatar({ name, avatarUrl, size, className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
