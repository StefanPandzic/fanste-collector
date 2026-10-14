'use client';

import {
  GAME_COMPLETENESS,
  GAME_EDITIONS,
  GAME_REGIONS,
  GAME_STOREFRONTS,
  MAX_DISC_COUNT,
  MAX_DLC_NOTES_LENGTH,
  VIDEO_GAME_FORMATS,
} from '@fanste/core';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useGamePlatforms } from '@/features/games/use-game-platforms';

import {
  platformOptions,
  showsGameDiscs,
  showsPhysicalGameDetails,
  showsStorefront,
} from './copy-form';
import { FormField } from './form-field';
import { OptionField } from './option-field';

import type { ChangeOptions } from './copy-form';
import type { CopyOption, GamePlatform, VideoGameDetails } from '@fanste/core';
import type { ReactNode } from 'react';

const FORMAT_OPTIONS: readonly CopyOption[] = VIDEO_GAME_FORMATS.map((value) => ({
  value,
  label: value,
}));

type OptionDetail = 'storefront' | 'edition' | 'region' | 'completeness';

const OPTION_FIELDS: readonly {
  field: OptionDetail;
  label: string;
  options: readonly CopyOption[];
  /** Whether a copy in the medium shows it; always when unset. */
  shows?: (format: string) => boolean;
  /** A fixed list: no "Other…". */
  fixed?: boolean;
}[] = [
  { field: 'storefront', label: 'Storefront', options: GAME_STOREFRONTS, shows: showsStorefront },
  { field: 'edition', label: 'Edition', options: GAME_EDITIONS },
  { field: 'region', label: 'Region', options: GAME_REGIONS, shows: showsPhysicalGameDetails },
  {
    field: 'completeness',
    label: 'Completeness',
    options: GAME_COMPLETENESS,
    shows: showsPhysicalGameDetails,
    fixed: true,
  },
];

interface VideoGameDetailsFieldsProps {
  /** Prefix of the control ids, unique on the page (e.g. `add`). */
  idPrefix?: string;
  format: string;
  details: VideoGameDetails;
  /** The game's platforms from IGDB, offered first. */
  gamePlatforms: readonly GamePlatform[] | undefined;
  /** `options.immediate` marks a pick (see `ChangeOptions`). */
  onFormatChange: (format: string, options: ChangeOptions) => void;
  onDetailChange: <K extends keyof VideoGameDetails>(
    field: K,
    value: VideoGameDetails[K],
    options: ChangeOptions,
  ) => void;
  /** The marker of a field (`format` or a details field), e.g. `from IGDB`. */
  markerOf: (field: string) => ReactNode;
  /** Errors keyed `format` or `details.<field>`. */
  errors: Readonly<Record<string, string>>;
  /** Shows the values read-only (e.g. a sold copy). */
  disabled?: boolean;
}

/**
 * The medium and copy details of a video game copy (FC-11). The platform offers the game's own
 * platforms first, then every other IGDB platform. The storefront shows for digital copies, the
 * discs for a disc, the region and completeness for a disc or cartridge.
 */
export function VideoGameDetailsFields({
  idPrefix = 'add',
  format,
  details,
  gamePlatforms,
  onFormatChange,
  onDetailChange,
  markerOf,
  errors,
  disabled,
}: VideoGameDetailsFieldsProps) {
  const idOf = (field: string) => `${idPrefix}-${field}`;
  const allPlatforms = useGamePlatforms();
  const platforms = platformOptions(gamePlatforms, allPlatforms);
  const visible = OPTION_FIELDS.filter(({ shows }) => !shows || shows(format));

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
        id={idOf('platform')}
        label="Platform"
        marker={markerOf('platform')}
        error={errors['details.platform']}
      >
        <OptionField
          // Mounted again once the full list is in, so a platform from it isn't shown as "Other".
          key={allPlatforms ? 'all' : 'game'}
          id={idOf('platform')}
          label="Platform"
          value={details.platform ?? ''}
          options={platforms.options}
          more={{ label: 'Other platforms', options: platforms.more }}
          onChange={(value, options) => onDetailChange('platform', value || undefined, options)}
          invalid={errors['details.platform'] !== undefined}
          disabled={disabled}
        />
      </FormField>

      {showsGameDiscs(format) && (
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
      )}

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
              // The completeness is a fixed list, so a picked value is always one of it.
              onDetailChange(field, value || undefined, options)
            }
            invalid={errors[`details.${field}`] !== undefined}
            disabled={disabled}
          />
        </FormField>
      ))}

      <FormField
        id={idOf('dlcNotes')}
        label="DLC included"
        hint="Expansions, season pass or bonus content in this copy."
        marker={markerOf('dlcNotes')}
        error={errors['details.dlcNotes']}
        className="sm:col-span-2"
      >
        <Textarea
          id={idOf('dlcNotes')}
          rows={2}
          maxLength={MAX_DLC_NOTES_LENGTH}
          value={details.dlcNotes ?? ''}
          onChange={(event) =>
            onDetailChange('dlcNotes', event.target.value || undefined, { immediate: false })
          }
          aria-invalid={errors['details.dlcNotes'] ? true : undefined}
          disabled={disabled}
        />
      </FormField>
    </div>
  );
}
