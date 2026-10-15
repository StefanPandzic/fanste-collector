'use client';

import { useId } from 'react';

import {
  EXPORT_SORT_LABELS,
  EXPORT_SORTS,
  PAPER_SIZE_LABELS,
  PAPER_SIZES,
  PDF_LAYOUT_LABELS,
} from '@fanste/export';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { ExportLayout, ExportSort, PaperSize, PdfLayout } from '@fanste/export';

// The format-specific options of the export dialog: CSV (FC-25) and PDF (FC-26).

interface RadioOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

function RadioCards<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled,
}: {
  legend: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 has-checked:border-primary has-checked:bg-accent"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1 accent-primary"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-sm text-muted-foreground">{option.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function CheckboxOption({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  label: string;
  description: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="flex flex-col items-start gap-0.5">
        <span>{label}</span>
        <span className="font-normal text-muted-foreground">{description}</span>
      </Label>
    </div>
  );
}

function SelectOption<T extends string>({
  label,
  value,
  values,
  labels,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  values: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((option) => (
            <SelectItem key={option} value={option}>
              {labels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface CsvSettings {
  layout: ExportLayout;
  sort: ExportSort;
  includeOriginal: boolean;
}

const CSV_LAYOUTS: RadioOption<ExportLayout>[] = [
  {
    value: 'single',
    label: 'One CSV file',
    description: 'Everything in one spreadsheet, with a Category column.',
  },
  {
    value: 'per-group',
    label: 'One CSV per category',
    description: 'A ZIP with a file per category and custom collection, each with its own columns.',
  },
];

export function CsvOptions({
  settings,
  onChange,
  disabled,
}: {
  settings: CsvSettings;
  onChange: (settings: CsvSettings) => void;
  disabled: boolean;
}) {
  return (
    <>
      <RadioCards
        legend="File"
        options={CSV_LAYOUTS}
        value={settings.layout}
        onChange={(layout) => onChange({ ...settings, layout })}
        disabled={disabled}
      />
      <SelectOption
        label="Order"
        value={settings.sort}
        values={EXPORT_SORTS}
        labels={EXPORT_SORT_LABELS}
        onChange={(sort) => onChange({ ...settings, sort })}
        disabled={disabled}
      />
      <CheckboxOption
        checked={settings.includeOriginal}
        onChange={(includeOriginal) => onChange({ ...settings, includeOriginal })}
        disabled={disabled}
        label="Include original values"
        description="Adds the provider's title, subtitle and year next to the ones you edited."
      />
    </>
  );
}

export interface PdfSettings {
  layout: PdfLayout;
  paper: PaperSize;
  includePrices: boolean;
}

const PDF_LAYOUTS: RadioOption<PdfLayout>[] = [
  {
    value: 'grid',
    label: PDF_LAYOUT_LABELS.grid,
    description: 'Cover art with the title, year, format and key details, 20 items per page.',
  },
  {
    value: 'insurance',
    label: PDF_LAYOUT_LABELS.insurance,
    description:
      'A table of the copies you have, with purchase prices, estimated values and totals per category.',
  },
];

export function PdfOptions({
  settings,
  onChange,
  disabled,
}: {
  settings: PdfSettings;
  onChange: (settings: PdfSettings) => void;
  disabled: boolean;
}) {
  return (
    <>
      <RadioCards
        legend="Layout"
        options={PDF_LAYOUTS}
        value={settings.layout}
        onChange={(layout) => onChange({ ...settings, layout })}
        disabled={disabled}
      />
      <SelectOption
        label="Paper size"
        value={settings.paper}
        values={PAPER_SIZES}
        labels={PAPER_SIZE_LABELS}
        onChange={(paper) => onChange({ ...settings, paper })}
        disabled={disabled}
      />
      {settings.layout === 'grid' && (
        <CheckboxOption
          checked={settings.includePrices}
          onChange={(includePrices) => onChange({ ...settings, includePrices })}
          disabled={disabled}
          label="Include prices"
          description="Shows each item's estimated value and the totals on the cover page."
        />
      )}
    </>
  );
}
