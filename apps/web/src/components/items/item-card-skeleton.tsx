import { cn } from 'cn';

import { Skeleton } from '@/components/ui/skeleton';

/** Loading stand-in with the same size as `ItemCard`. */
export function ItemCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex flex-col gap-2 rounded-xl bg-card p-1.5 pb-card shadow-card', className)}
    >
      <Skeleton className="aspect-cover w-full rounded-lg" />
      <div className="flex flex-col gap-1 px-1.5">
        <Skeleton className="my-0.5 h-4 w-3/4" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-5 w-7 rounded-4xl" />
        </div>
      </div>
    </div>
  );
}

/** A grid of card skeletons, using the same column sizing as `ItemGrid`. */
export function ItemGridSkeleton({
  count = 12,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading items"
      className={cn('grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4', className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <ItemCardSkeleton key={index} />
      ))}
    </div>
  );
}
