import { cn } from 'cn';

/** The number of scanned files that need review, next to the Scanner nav entry (FC-24). */
export function ReviewBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        'min-w-5 rounded-full bg-warning px-1.5 text-center text-xs font-semibold text-warning-foreground tabular-nums',
        className,
      )}
    >
      {count > 999 ? '999+' : count.toLocaleString()}
      <span className="sr-only"> {count === 1 ? 'file needs' : 'files need'} review</span>
    </span>
  );
}
