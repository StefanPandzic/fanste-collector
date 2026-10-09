import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { FormState } from './form-state';
import type { ComponentProps } from 'react';

interface FieldProps extends Omit<ComponentProps<typeof Input>, 'name' | 'id'> {
  name: string;
  label: string;
  state: FormState;
}

/** A labelled input that shows the field's errors from a Server Action's {@link FormState}. */
export function Field({ name, label, state, ...props }: FieldProps) {
  const errors = state.fieldErrors?.[name];
  const errorId = `${name}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        {...props}
      />
      {errors && (
        <p id={errorId} className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

/** The form-level error or success message of a {@link FormState}. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}
