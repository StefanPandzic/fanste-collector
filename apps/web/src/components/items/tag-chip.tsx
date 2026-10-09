import { cn } from 'cn';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

interface TagChipProps {
  label: string;
  /** Adds a remove button. */
  onRemove?: () => void;
  className?: string;
}

/** A user tag. */
export function TagChip({ label, onRemove, className }: TagChipProps) {
  return (
    <Badge variant="outline" className={cn(onRemove && 'pr-0.5', className)}>
      <span className="max-w-40 truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${label}`}
          className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-3" />
        </button>
      )}
    </Badge>
  );
}
