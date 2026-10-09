import { cn } from 'cn';

import { ownershipLabel } from '@fanste/core';

import { Badge } from '@/components/ui/badge';

import { ownershipClasses } from './category-style';

import type { OwnershipStatus } from '@fanste/core';

interface OwnershipBadgeProps {
  status: OwnershipStatus;
  /**
   * `soft` (default) sits on the page; `overlay` is opaque, for placing on top of cover art. Both
   * pair the color with the label, so the status never depends on color alone.
   */
  variant?: 'soft' | 'overlay';
  className?: string;
}

export function OwnershipBadge({ status, variant = 'soft', className }: OwnershipBadgeProps) {
  const classes = ownershipClasses(status);
  return (
    <Badge
      variant="secondary"
      className={cn(
        variant === 'soft'
          ? classes.soft
          : 'bg-background/90 text-foreground shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', classes.dot)} />
      {ownershipLabel(status)}
    </Badge>
  );
}
