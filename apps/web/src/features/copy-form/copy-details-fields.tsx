'use client';

import {
  AUDIO_CHANNELS,
  DIGITAL_STORES,
  DISC_REGIONS,
  HDR_FORMATS,
  MAX_DISC_COUNT,
  MOVIE_EDITIONS,
  MOVIE_TV_FORMATS,
  RESOLUTIONS,
  VIDEO_FILE_FORMATS,
} from '@fanste/core';

import { Input } from '@/components/ui/input';

import { showsDigitalStore, showsFileFormat } from './copy-form';
import { FormField } from './form-field';
import { LanguagePicker } from './language-picker';
import { OptionField } from './option-field';
import { SeasonPicker } from './season-picker';

import type { ChangeOptions } from './copy-form';
import type { CopyOption, TvDetails, TvSeason } from '@fanste/core';

const FORMAT_OPTIONS: readonly CopyOption[] = MOVIE_TV_FORMATS.map((value) => ({
  value,
  label: value,
}));

type OptionDetail =
  'resolution' | 'hdr' | 'audioChannels' | 'fileFormat' | 'edition' | 'region' | 'digitalStore';

const OPTION_FIELDS: readonly {
  field: OptionDetail;
  label: string;
  options: readonly CopyOption[];
}[] = [
  { field: 'resolution', label: 'Resolution', options: RESOLUTIONS },
  { field: 'hdr', label: 'HDR', options: HDR_FORMATS },
  { field: 'audioChannels', label: 'Audio channels', options: AUDIO_CHANNELS },
  { field: 'fileFormat', label: 'File format', options: VIDEO_FILE_FORMATS },
  { field: 'digitalStore', label: 'Digital store', options: DIGITAL_STORES },
  { field: 'edition', label: 'Edition', options: MOVIE_EDITIONS },
  { field: 'region', label: 'Region', options: DISC_REGIONS },
];

interface CopyDetailsFieldsProps {
  /** Prefix of the control ids, unique on the page (e.g. `add`). */
  idPrefix?: string;
  category: 'movie' | 'tv';
  format: string;
  details: TvDetails;
  /** The show's seasons (TV), from `prefillDetails`' choices. */
  seasons?: readonly TvSeason[];
  /** `options.immediate` marks a pick (see `ChangeOptions`). */
  onFormatChange: (format: string, options: ChangeOptions) => void;
  onDetailChange: <K extends keyof TvDetails>(
    field: K,
    value: TvDetails[K],
    options: ChangeOptions,
  ) => void;
  /** The prefill marker of a field (`format` or a details field), if it still has one. */
  markerOf: (field: string) => string | undefined;
  /** Errors keyed `format` or `details.<field>`. */
  errors: Readonly<Record<string, string>>;
  /** Shows the values read-only (e.g. a sold copy). */
  disabled?: boolean;
}

/**
 * The medium and copy details of a movie or TV copy (FC-15), prefilled and editable. File format
 * and digital store show only for their medium.
 */
export function CopyDetailsFields({
  idPrefix = 'add',
  category,
  format,
  details,
  seasons,
  onFormatChange,
  onDetailChange,
  markerOf,
  errors,
  disabled,
}: CopyDetailsFieldsProps) {
  const idOf = (field: string) => `${idPrefix}-${field}`;
  const visible = OPTION_FIELDS.filter(
    ({ field }) =>
      (field !== 'fileFormat' || showsFileFormat(format)) &&
      (field !== 'digitalStore' || showsDigitalStore(format)),
  );

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

      {visible.map(({ field, label, options }) => (
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
            onChange={(value, options) => onDetailChange(field, value || undefined, options)}
            invalid={errors[`details.${field}`] !== undefined}
            disabled={disabled}
          />
        </FormField>
      ))}

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
        id={idOf('audioLanguages')}
        label="Audio languages"
        marker={markerOf('audioLanguages')}
        hint="The first one is the main language."
        className="sm:col-span-2"
      >
        <LanguagePicker
          id={idOf('audioLanguages')}
          label="Audio languages"
          value={details.audioLanguages ?? []}
          onChange={(value, options) => onDetailChange('audioLanguages', value, options)}
          withMain
          disabled={disabled}
        />
      </FormField>

      <FormField
        id={idOf('subtitleLanguages')}
        label="Subtitle languages"
        marker={markerOf('subtitleLanguages')}
        className="sm:col-span-2"
      >
        <LanguagePicker
          id={idOf('subtitleLanguages')}
          label="Subtitle languages"
          value={details.subtitleLanguages ?? []}
          onChange={(value, options) => onDetailChange('subtitleLanguages', value, options)}
          disabled={disabled}
        />
      </FormField>

      {category === 'tv' && seasons && seasons.length > 0 && (
        <FormField
          id={idOf('seasons')}
          label="Seasons owned"
          marker={markerOf('seasons')}
          error={errors['details.seasons']}
          className="sm:col-span-2"
        >
          <SeasonPicker
            seasons={seasons}
            value={details.seasons ?? []}
            onChange={(value, options) => onDetailChange('seasons', value, options)}
            invalid={errors['details.seasons'] !== undefined}
            disabled={disabled}
          />
        </FormField>
      )}
    </div>
  );
}
