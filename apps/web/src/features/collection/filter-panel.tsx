'use client';

import { useId, useState } from 'react';

import {
  HDR_FORMATS,
  languageLabel,
  MAX_FILTER_VALUES,
  MOVIE_EDITIONS,
  MOVIE_TV_FORMATS,
  OWNERSHIP_STATUSES,
  ownershipLabel,
  RESOLUTIONS,
} from '@fanste/core';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { filterOptions } from './filter-options';
import { SOURCE_OPTIONS } from './gallery-items';
import { toggleValue, withDetailFilter } from './gallery-state';

import type { FilterOption } from './filter-options';
import type { CollectionFacets, CollectionFilter, CopyOption, Tag } from '@fanste/core';

interface FilterPanelProps {
  filter: CollectionFilter;
  /** Counts per value; `undefined` while they load. */
  facets: CollectionFacets | undefined;
  tags: readonly Tag[];
  onChange: (filter: CollectionFilter) => void;
}

const OWNERSHIP_OPTIONS: readonly CopyOption[] = OWNERSHIP_STATUSES.map((status) => ({
  value: status,
  label: ownershipLabel(status),
}));
const FORMAT_OPTIONS: readonly CopyOption[] = MOVIE_TV_FORMATS.map((value) => ({
  value,
  label: value,
}));
const EDITION_OPTIONS: readonly CopyOption[] = MOVIE_EDITIONS;

/**
 * The gallery's filters with their counts (FC-18). A sidebar on wide windows and the content of the
 * filter drawer on narrow ones. Category and search are in the toolbar.
 */
export function FilterPanel({ filter, facets, tags, onChange }: FilterPanelProps) {
  const tagOptions = tags.map((tag) => ({ value: tag.id, label: tag.name }));
  const showVideoDetails =
    filter.category === undefined || filter.category === 'movie' || filter.category === 'tv';

  function setDetail(key: keyof NonNullable<CollectionFilter['details']>, value: string) {
    onChange(withDetailFilter(filter, key, toggleValue(filter.details?.[key], value)));
  }

  return (
    <div className="flex flex-col gap-6">
      <OptionGroup
        title="Ownership"
        options={filterOptions(OWNERSHIP_OPTIONS, facets?.ownership, filter.ownership)}
        selected={filter.ownership}
        onToggle={(value) =>
          onChange({
            ...filter,
            ownership: toggleValue(filter.ownership, value as (typeof OWNERSHIP_STATUSES)[number]),
          })
        }
      />
      <OptionGroup
        title="Medium"
        options={filterOptions(FORMAT_OPTIONS, facets?.format, filter.formats)}
        selected={filter.formats}
        onToggle={(value) => onChange({ ...filter, formats: toggleValue(filter.formats, value) })}
      />
      {tagOptions.length > 0 && (
        <OptionGroup
          title="Tags"
          options={filterOptions(tagOptions, facets?.tag, filter.tagIds)}
          selected={filter.tagIds}
          onToggle={(value) => onChange({ ...filter, tagIds: toggleValue(filter.tagIds, value) })}
        />
      )}
      <OptionGroup
        title="Added"
        options={filterOptions(SOURCE_OPTIONS, facets?.source, filter.sources)}
        selected={filter.sources}
        onToggle={(value) =>
          onChange({
            ...filter,
            sources: toggleValue(filter.sources, value as (typeof SOURCE_OPTIONS)[number]['value']),
          })
        }
      />
      <DateRange filter={filter} onChange={onChange} />

      {showVideoDetails && (
        <>
          <OptionGroup
            title="Resolution"
            options={filterOptions(RESOLUTIONS, facets?.resolution, filter.details?.resolution)}
            selected={filter.details?.resolution}
            onToggle={(value) => setDetail('resolution', value)}
          />
          <OptionGroup
            title="HDR"
            options={filterOptions(HDR_FORMATS, facets?.hdr, filter.details?.hdr)}
            selected={filter.details?.hdr}
            onToggle={(value) => setDetail('hdr', value)}
          />
          <OptionGroup
            title="Edition"
            options={filterOptions(EDITION_OPTIONS, facets?.edition, filter.details?.edition)}
            selected={filter.details?.edition}
            onToggle={(value) => setDetail('edition', value)}
          />
          <OptionGroup
            title="Audio language"
            options={filterOptions(
              [],
              facets?.audioLanguage,
              filter.details?.audioLanguages,
              languageLabel,
            )}
            selected={filter.details?.audioLanguages}
            onToggle={(value) => setDetail('audioLanguages', value)}
          />
          <OptionGroup
            title="Subtitles"
            options={filterOptions(
              [],
              facets?.subtitleLanguage,
              filter.details?.subtitleLanguages,
              languageLabel,
            )}
            selected={filter.details?.subtitleLanguages}
            onToggle={(value) => setDetail('subtitleLanguages', value)}
          />
        </>
      )}
    </div>
  );
}

/** Options shown before "Show all". */
const COLLAPSED_OPTIONS = 6;

interface OptionGroupProps {
  title: string;
  options: readonly FilterOption[];
  selected: readonly string[] | undefined;
  onToggle: (value: string) => void;
}

/** A filter's values as checkboxes with counts. Hidden when there is nothing to choose. */
function OptionGroup({ title, options, selected = [], onToggle }: OptionGroupProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  if (options.length === 0) return null;

  // Selected values always stay visible.
  const visible = expanded
    ? options
    : options.filter(
        (option, index) => index < COLLAPSED_OPTIONS || selected.includes(option.value),
      );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{title}</legend>
      {visible.map((option) => {
        const checkboxId = `${id}-${option.value}`;
        return (
          <div key={option.value} className="flex items-center gap-2">
            <Checkbox
              id={checkboxId}
              checked={selected.includes(option.value)}
              // A filter takes at most `MAX_FILTER_VALUES`; selected values can always be cleared.
              disabled={!selected.includes(option.value) && selected.length >= MAX_FILTER_VALUES}
              onCheckedChange={() => onToggle(option.value)}
            />
            <Label htmlFor={checkboxId} className="min-w-0 flex-1 font-normal">
              <span className="truncate">{option.label}</span>
            </Label>
            {option.count !== undefined && (
              <span className="text-caption text-muted-foreground tabular-nums">
                {option.count.toLocaleString()}
              </span>
            )}
          </div>
        );
      })}
      {options.length > visible.length && (
        <Button
          variant="link"
          size="xs"
          className="self-start px-0"
          onClick={() => setExpanded(true)}
        >
          Show all ({options.length})
        </Button>
      )}
    </fieldset>
  );
}

function DateRange({
  filter,
  onChange,
}: {
  filter: CollectionFilter;
  onChange: (filter: CollectionFilter) => void;
}) {
  const id = useId();
  // An empty or half-typed date reads as "" and removes that end of the range.
  const set = (key: 'acquiredFrom' | 'acquiredTo', value: string) => {
    const next = { ...filter, [key]: value || undefined };
    if (!value) delete next[key];
    onChange(next);
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Acquired</legend>
      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
        <Label htmlFor={`${id}-from`} className="font-normal text-muted-foreground">
          From
        </Label>
        <Input
          id={`${id}-from`}
          type="date"
          value={filter.acquiredFrom ?? ''}
          max={filter.acquiredTo}
          onChange={(event) => set('acquiredFrom', event.target.value)}
        />
        <Label htmlFor={`${id}-to`} className="font-normal text-muted-foreground">
          To
        </Label>
        <Input
          id={`${id}-to`}
          type="date"
          value={filter.acquiredTo ?? ''}
          min={filter.acquiredFrom}
          onChange={(event) => set('acquiredTo', event.target.value)}
        />
      </div>
    </fieldset>
  );
}
