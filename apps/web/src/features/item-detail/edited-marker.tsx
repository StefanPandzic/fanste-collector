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
}

/** Marks a field the user overrode (FC-15); hover or focus shows the provider's value. */
export function EditedMarker({ hint, onReset, field }: EditedMarkerProps) {
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
          aria-label={field ? `Reset ${field} to original` : 'Reset to original'}
        >
          <RotateCcw aria-hidden />
          Reset
        </Button>
      )}
    </span>
  );
}
