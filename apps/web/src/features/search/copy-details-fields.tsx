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

import { showsDigitalStore, showsFileFormat } from './add-item-form';
import { FormField } from './form-field';
import { LanguagePicker } from './language-picker';
import { OptionField } from './option-field';
import { SeasonPicker } from './season-picker';

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
  category: 'movie' | 'tv';
  format: string;
  details: TvDetails;
  /** The show's seasons (TV), from `prefillDetails`' choices. */
  seasons?: readonly TvSeason[];
  onFormatChange: (format: string) => void;
  onDetailChange: <K extends keyof TvDetails>(field: K, value: TvDetails[K]) => void;
  /** The prefill marker of a field (`format` or a details field), if it still has one. */
  markerOf: (field: string) => string | undefined;
  /** Errors keyed `format` or `details.<field>`. */
  errors: Readonly<Record<string, string>>;
}

/**
 * The medium and copy details of a movie or TV copy (FC-15), prefilled and editable. File format
 * and digital store show only for their medium.
 */
export function CopyDetailsFields({
  category,
  format,
  details,
  seasons,
  onFormatChange,
  onDetailChange,
  markerOf,
  errors,
}: CopyDetailsFieldsProps) {
  const visible = OPTION_FIELDS.filter(
    ({ field }) =>
      (field !== 'fileFormat' || showsFileFormat(format)) &&
      (field !== 'digitalStore' || showsDigitalStore(format)),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="add-format" label="Medium" marker={markerOf('format')} error={errors.format}>
        <OptionField
          id="add-format"
          label="Medium"
          value={format}
          options={FORMAT_OPTIONS}
          onChange={onFormatChange}
          invalid={errors.format !== undefined}
        />
      </FormField>

      {visible.map(({ field, label, options }) => (
        <FormField
          key={field}
          id={`add-${field}`}
          label={label}
          marker={markerOf(field)}
          error={errors[`details.${field}`]}
        >
          <OptionField
            id={`add-${field}`}
            label={label}
            value={details[field] ?? ''}
            options={options}
            onChange={(value) => onDetailChange(field, value || undefined)}
            invalid={errors[`details.${field}`] !== undefined}
          />
        </FormField>
      ))}

      <FormField
        id="add-discCount"
        label="Discs"
        marker={markerOf('discCount')}
        error={errors['details.discCount']}
      >
        <Input
          id="add-discCount"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_DISC_COUNT}
          value={details.discCount ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            onDetailChange('discCount', value === '' ? undefined : Number(value));
          }}
          aria-invalid={errors['details.discCount'] ? true : undefined}
        />
      </FormField>

      <FormField
        id="add-audioLanguages"
        label="Audio languages"
        marker={markerOf('audioLanguages')}
        hint="The first one is the main language."
        className="sm:col-span-2"
      >
        <LanguagePicker
          id="add-audioLanguages"
          label="Audio languages"
          value={details.audioLanguages ?? []}
          onChange={(value) => onDetailChange('audioLanguages', value)}
          withMain
        />
      </FormField>

      <FormField
        id="add-subtitleLanguages"
        label="Subtitle languages"
        marker={markerOf('subtitleLanguages')}
        className="sm:col-span-2"
      >
        <LanguagePicker
          id="add-subtitleLanguages"
          label="Subtitle languages"
          value={details.subtitleLanguages ?? []}
          onChange={(value) => onDetailChange('subtitleLanguages', value)}
        />
      </FormField>

      {category === 'tv' && seasons && seasons.length > 0 && (
        <FormField
          id="add-seasons"
          label="Seasons owned"
          marker={markerOf('seasons')}
          error={errors['details.seasons']}
          className="sm:col-span-2"
        >
          <SeasonPicker
            seasons={seasons}
            value={details.seasons ?? []}
            onChange={(value) => onDetailChange('seasons', value)}
            invalid={errors['details.seasons'] !== undefined}
          />
        </FormField>
      )}
    </div>
  );
}
