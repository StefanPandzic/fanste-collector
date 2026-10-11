'use client';

import { RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface EditedMarkerProps {
  /** The provider's own value, e.g. `Original: Inception`. */
  hint: string;
  /** Adds a "Reset to original" button. */
  onReset?: () => void;
  /** Field name, for the reset button's accessible name. */
  field?: string;
  /** What the reset goes back to, for its accessible name (default: `original`). */
  resetTo?: string;
}

/**
 * Marks a field the user overrode (FC-15), or a copy detail they changed from what its file said
 * (FC-23); hover or focus shows the original value.
 */
export function EditedMarker({ hint, onReset, field, resetTo = 'original' }: EditedMarkerProps) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            asChild
            variant="outline"
            className="cursor-help font-normal text-muted-foreground"
          >
            <button type="button" aria-label={`Edited. ${hint}`}>
              edited
            </button>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
      {onReset && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onReset}
          aria-label={field ? `Reset ${field} to ${resetTo}` : `Reset to ${resetTo}`}
        >
          <RotateCcw aria-hidden />
          Reset
        </Button>
      )}
    </span>
  );
}
