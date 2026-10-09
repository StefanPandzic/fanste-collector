import { cn } from 'cn';
import { RotateCcw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  /** A message meant for users (e.g. a mapped gateway error), never a raw error. */
  description?: string;
  /** Adds a retry button. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Shown in place of content that failed to load. Announced to screen readers. */
export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert aria-hidden className="size-6" />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-heading">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-2">
          <RotateCcw aria-hidden />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
