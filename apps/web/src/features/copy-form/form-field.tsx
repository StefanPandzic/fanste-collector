import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

import type { ReactNode } from 'react';

interface FormFieldProps {
  /** `id` of the control, for the label. */
  id: string;
  label: string;
  /**
   * Marker next to the label: text (a prefill source like `from TMDB`, shown as a badge) or an
   * element of its own, e.g. the item page's "edited" marker.
   */
  marker?: ReactNode;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** A labelled control of the add dialog, with its prefill marker and error. */
export function FormField({ id, label, marker, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {!marker ? null : typeof marker === 'string' ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {marker}
          </Badge>
        ) : (
          marker
        )}
      </div>
      {children}
      {hint && !error && <p className="text-caption text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
