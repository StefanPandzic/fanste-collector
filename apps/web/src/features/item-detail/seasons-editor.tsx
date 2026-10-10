'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  AUDIO_CHANNELS,
  formatOwnedEpisodes,
  MOVIE_TV_FORMATS,
  ownedEpisodeCount,
  RESOLUTIONS,
  VIDEO_FILE_FORMATS,
} from '@fanste/core';

import { Button } from '@/components/ui/button';
import { showsFileFormat } from '@/features/copy-form/copy-form';
import type { ChangeOptions } from '@/features/copy-form/copy-form';
import { FormField } from '@/features/copy-form/form-field';
import { LanguagePicker } from '@/features/copy-form/language-picker';
import { OptionField } from '@/features/copy-form/option-field';
import { SeasonPicker } from '@/features/copy-form/season-picker';

import type { CopyOption, TvDetails, TvExtra, TvSeasonDetails } from '@fanste/core';

const FORMAT_OPTIONS: readonly CopyOption[] = MOVIE_TV_FORMATS.map((value) => ({
  value,
  label: value,
}));

type SeasonOption = 'format' | 'resolution' | 'audioChannels' | 'fileFormat';

const SEASON_OPTIONS: readonly {
  field: SeasonOption;
  label: string;
  options: readonly CopyOption[];
}[] = [
  { field: 'format', label: 'Medium', options: FORMAT_OPTIONS },
  { field: 'resolution', label: 'Resolution', options: RESOLUTIONS },
  { field: 'audioChannels', label: 'Audio channels', options: AUDIO_CHANNELS },
  { field: 'fileFormat', label: 'File format', options: VIDEO_FILE_FORMATS },
];

interface SeasonsEditorProps {
  /** The copy's details (show defaults and `seasons`). */
  details: TvDetails;
  /** The copy's medium, the default of each season's. */
  format: string;
  tvExtra: TvExtra | undefined;
  onChange: (seasons: TvSeasonDetails[], options: ChangeOptions) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * The owned seasons of a TV copy (FC-15): one row per TMDB season, all or some episodes, and per
 * season the languages and quality where they differ from the show's.
 */
export function SeasonsEditor({
  details,
  format,
  tvExtra,
  onChange,
  error,
  disabled,
}: SeasonsEditorProps) {
  const seasons = tvExtra?.seasons ?? [];
  const summary = formatOwnedEpisodes(ownedEpisodeCount(details, tvExtra));

  if (seasons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        The show&apos;s seasons aren&apos;t loaded yet. Try &ldquo;Refresh metadata&rdquo; if this
        stays empty.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium" role="status">
        {summary === 'No episodes' ? 'No seasons owned' : `${summary} owned`}
      </p>
      <SeasonPicker
        idPrefix="item-season"
        seasons={seasons}
        value={details.seasons ?? []}
        onChange={onChange}
        invalid={error !== undefined}
        disabled={disabled}
        renderSeasonExtra={(entry, update) => (
          <SeasonOverrides
            entry={entry}
            details={details}
            showFormat={format}
            onChange={update}
            disabled={disabled}
          />
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

interface SeasonOverridesProps {
  entry: TvSeasonDetails;
  details: TvDetails;
  showFormat: string;
  onChange: (entry: TvSeasonDetails, options: ChangeOptions) => void;
  disabled?: boolean;
}

/** A season's own medium, quality and languages; unset fields use the show's. */
function SeasonOverrides({ entry, details, showFormat, onChange, disabled }: SeasonOverridesProps) {
  const [open, setOpen] = useState(false);
  const idOf = (field: string) => `season-${entry.seasonNumber}-${field}`;
  const overrides =
    SEASON_OPTIONS.filter(({ field }) => entry[field] !== undefined).length +
    (entry.audioLanguages ? 1 : 0) +
    (entry.subtitleLanguages ? 1 : 0);
  const format = entry.format ?? showFormat;
  const shown = SEASON_OPTIONS.filter(
    ({ field }) => field !== 'fileFormat' || showsFileFormat(format),
  );

  function set<K extends keyof TvSeasonDetails>(
    field: K,
    value: TvSeasonDetails[K] | undefined,
    options: ChangeOptions,
  ) {
    const next = { ...entry };
    if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[field];
    else next[field] = value;
    onChange(next, options);
  }

  /** The show's value a season field falls back to. */
  function showValue(field: SeasonOption): string | undefined {
    return field === 'format' ? showFormat || undefined : details[field];
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-fit"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown aria-hidden className={open ? 'rotate-180' : undefined} />
        Season details
        {overrides > 0 && <span className="text-muted-foreground">({overrides} set)</span>}
      </Button>
      {open && (
        <div className="grid gap-4 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
          {shown.map(({ field, label, options }) => {
            const fallback = showValue(field);
            return (
              <FormField
                key={field}
                id={idOf(field)}
                label={label}
                hint={fallback ? `Not set: uses the show's ${fallback}.` : undefined}
              >
                <OptionField
                  id={idOf(field)}
                  label={label}
                  value={entry[field] ?? ''}
                  options={options}
                  onChange={(value, options) => set(field, value || undefined, options)}
                  disabled={disabled}
                />
              </FormField>
            );
          })}
          <FormField
            id={idOf('audioLanguages')}
            label="Audio languages"
            hint={entry.audioLanguages ? undefined : "Not set: uses the show's."}
            className="sm:col-span-2"
          >
            <LanguagePicker
              id={idOf('audioLanguages')}
              label="Audio languages"
              value={entry.audioLanguages ?? []}
              onChange={(value, options) => set('audioLanguages', value, options)}
              withMain
              disabled={disabled}
            />
          </FormField>
          <FormField
            id={idOf('subtitleLanguages')}
            label="Subtitle languages"
            hint={entry.subtitleLanguages ? undefined : "Not set: uses the show's."}
            className="sm:col-span-2"
          >
            <LanguagePicker
              id={idOf('subtitleLanguages')}
              label="Subtitle languages"
              value={entry.subtitleLanguages ?? []}
              onChange={(value, options) => set('subtitleLanguages', value, options)}
              disabled={disabled}
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
