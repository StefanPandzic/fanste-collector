import { cn } from 'cn';
import { PackageOpen, type LucideIcon } from 'lucide-react';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** E.g. a button that leads to search. */
  action?: ReactNode;
  className?: string;
}

/** Shown where a list or page has nothing to show yet. */
export function EmptyState({
  title,
  description,
  icon: Icon = PackageOpen,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-6" />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-heading">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
