import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

import type { ReactNode } from 'react';

interface FormFieldProps {
  /** `id` of the control, for the label. */
  id: string;
  label: string;
  /** Prefill marker, e.g. `from TMDB`, shown until the user changes the value. */
  marker?: string;
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
        {marker && (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {marker}
          </Badge>
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
