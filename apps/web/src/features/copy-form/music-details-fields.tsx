'use client';

import {
  CONDITION_GRADES,
  MAX_DISC_COUNT,
  MAX_OPTION_LENGTH,
  MUSIC_FORMATS,
  SLEEVE_GRADES,
  VINYL_SIZES,
  VINYL_SPEEDS,
  VINYL_VARIANTS,
} from '@fanste/core';

import { Input } from '@/components/ui/input';

import { showsVinylDetails } from './copy-form';
import { FormField } from './form-field';
import { OptionField } from './option-field';

import type { ChangeOptions } from './copy-form';
import type { CopyOption, MusicDetails } from '@fanste/core';
import type { ReactNode } from 'react';

const FORMAT_OPTIONS: readonly CopyOption[] = MUSIC_FORMATS.map((value) => ({
  value,
  label: value,
}));

type OptionDetail = 'vinylSize' | 'speed' | 'variant' | 'mediaCondition' | 'sleeveCondition';

const OPTION_FIELDS: readonly {
  field: OptionDetail;
  label: string;
  options: readonly CopyOption[];
  /** Vinyl only. */
  vinyl?: boolean;
  /** A fixed scale: no "Other…". */
  fixed?: boolean;
}[] = [
  { field: 'vinylSize', label: 'Vinyl size', options: VINYL_SIZES, vinyl: true },
  { field: 'speed', label: 'Speed', options: VINYL_SPEEDS, vinyl: true },
  { field: 'variant', label: 'Variant', options: VINYL_VARIANTS, vinyl: true },
  { field: 'mediaCondition', label: 'Media condition', options: CONDITION_GRADES, fixed: true },
  { field: 'sleeveCondition', label: 'Sleeve condition', options: SLEEVE_GRADES, fixed: true },
];

interface MusicDetailsFieldsProps {
  /** Prefix of the control ids, unique on the page (e.g. `add`). */
  idPrefix?: string;
  format: string;
  details: MusicDetails;
  /** `options.immediate` marks a pick (see `ChangeOptions`). */
  onFormatChange: (format: string, options: ChangeOptions) => void;
  onDetailChange: <K extends keyof MusicDetails>(
    field: K,
    value: MusicDetails[K],
    options: ChangeOptions,
  ) => void;
  /** The marker of a field (`format` or a details field), e.g. `from Discogs`. */
  markerOf: (field: string) => ReactNode;
  /** Errors keyed `format` or `details.<field>`. */
  errors: Readonly<Record<string, string>>;
  /** Shows the values read-only (e.g. a sold copy). */
  disabled?: boolean;
}

/**
 * The medium and copy details of a music copy (FC-10), prefilled from the Discogs release and
 * editable. Size, speed and variant show only for vinyl.
 */
export function MusicDetailsFields({
  idPrefix = 'add',
  format,
  details,
  onFormatChange,
  onDetailChange,
  markerOf,
  errors,
  disabled,
}: MusicDetailsFieldsProps) {
  const idOf = (field: string) => `${idPrefix}-${field}`;
  const visible = OPTION_FIELDS.filter(({ vinyl }) => !vinyl || showsVinylDetails(format));

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
        id={idOf('discCount')}
        label="Discs"
        marker={markerOf('discCount')}
        error={errors['details.discCount']}
      >
        <Input
          id={idOf('discCount')}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_DISC_COUNT}
          value={details.discCount ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onDetailChange('discCount', value === '' ? undefined : Number(value), {
              immediate: false,
            });
          }}
          aria-invalid={errors['details.discCount'] ? true : undefined}
          disabled={disabled}
        />
      </FormField>

      <FormField
        id={idOf('catalogNumber')}
        label="Catalog number"
        marker={markerOf('catalogNumber')}
        error={errors['details.catalogNumber']}
      >
        <Input
          id={idOf('catalogNumber')}
          maxLength={MAX_OPTION_LENGTH}
          value={details.catalogNumber ?? ''}
          onChange={(event) =>
            onDetailChange('catalogNumber', event.target.value || undefined, { immediate: false })
          }
          aria-invalid={errors['details.catalogNumber'] ? true : undefined}
          disabled={disabled}
        />
      </FormField>

      {visible.map(({ field, label, options, fixed }) => (
        <FormField
          key={field}
          id={idOf(field)}
          label={label}
          marker={markerOf(field)}
          error={errors[`details.${field}`]}
        >
          <OptionField
            id={idOf(field)}
            label={label}
            value={details[field] ?? ''}
            options={options}
            allowOther={!fixed}
            onChange={(value, options) =>
              // The grades are a fixed scale, so a picked value is always one of them.
              onDetailChange(field, value || undefined, options)
            }
            invalid={errors[`details.${field}`] !== undefined}
            disabled={disabled}
          />
        </FormField>
      ))}
    </div>
  );
}
