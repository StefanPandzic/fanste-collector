'use client';

import { CUSTOM_CONDITIONS, CUSTOM_FORMATS, MAX_OPTION_LENGTH } from '@fanste/core';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { FormField } from './form-field';
import { OptionField } from './option-field';

import type { ChangeOptions } from './copy-form';
import type { CopyOption, CustomDetails } from '@fanste/core';
import type { ReactNode } from 'react';

const FORMAT_OPTIONS: readonly CopyOption[] = CUSTOM_FORMATS.map((value) => ({
  value,
  label: value,
}));

interface CustomDetailsFieldsProps {
  /** Prefix of the control ids, unique on the page (e.g. `add`). */
  idPrefix?: string;
  format: string;
  details: CustomDetails;
  /** `options.immediate` marks a pick (see `ChangeOptions`). */
  onFormatChange: (format: string, options: ChangeOptions) => void;
  onDetailChange: <K extends keyof CustomDetails>(
    field: K,
    value: CustomDetails[K],
    options: ChangeOptions,
  ) => void;
  /** The marker of a field (`format` or a details field), e.g. "edited". */
  markerOf?: (field: string) => ReactNode;
  /** Errors keyed `format` or `details.<field>`. */
  errors: Readonly<Record<string, string>>;
  /** Shows the values read-only (e.g. a sold copy). */
  disabled?: boolean;
}

/**
 * The copy of an item in a custom collection (FC-13): medium, condition, variant and whether it has
 * its box. Generic enough for any kind of object.
 */
export function CustomDetailsFields({
  idPrefix = 'add',
  format,
  details,
  onFormatChange,
  onDetailChange,
  markerOf = () => undefined,
  errors,
  disabled,
}: CustomDetailsFieldsProps) {
  const idOf = (field: string) => `${idPrefix}-${field}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        id={idOf('format')}
        label="Medium"
        marker={markerOf('format')}
        error={errors.format}
      >
        <OptionField
          id={idOf('format')}
          label="Medium"
          value={format}
          options={FORMAT_OPTIONS}
          onChange={onFormatChange}
          invalid={errors.format !== undefined}
          disabled={disabled}
        />
      </FormField>

      <FormField
        id={idOf('condition')}
        label="Condition"
        marker={markerOf('condition')}
        error={errors['details.condition']}
      >
        <OptionField
          id={idOf('condition')}
          label="Condition"
          value={details.condition ?? ''}
          options={CUSTOM_CONDITIONS}
          allowOther={false}
          // A fixed scale, so a picked value is always one of them.
          onChange={(value, options) =>
            onDetailChange('condition', (value || undefined) as CustomDetails['condition'], options)
          }
          invalid={errors['details.condition'] !== undefined}
          disabled={disabled}
        />
      </FormField>

      <FormField
        id={idOf('variant')}
        label="Variant"
        hint="Edition, variant or color, e.g. Chase or Glow in the dark."
        marker={markerOf('variant')}
        error={errors['details.variant']}
      >
        <Input
          id={idOf('variant')}
          maxLength={MAX_OPTION_LENGTH}
          value={details.variant ?? ''}
          onChange={(event) =>
            onDetailChange('variant', event.target.value || undefined, { immediate: false })
          }
          aria-invalid={errors['details.variant'] ? true : undefined}
          disabled={disabled}
        />
      </FormField>

      <div className="flex items-center gap-2 self-end pb-2">
        <Checkbox
          id={idOf('boxed')}
          checked={details.boxed ?? false}
          onCheckedChange={(checked) =>
            onDetailChange('boxed', checked === true, { immediate: true })
          }
          disabled={disabled}
        />
        <Label htmlFor={idOf('boxed')}>With box or packaging</Label>
        {markerOf('boxed')}
      </div>
    </div>
  );
}
