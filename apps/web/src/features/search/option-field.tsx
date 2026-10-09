'use client';

import { useState } from 'react';

import { MAX_OPTION_LENGTH } from '@fanste/core';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { CopyOption } from '@fanste/core';

// Radix Select items can't have an empty value.
const NONE = '__none__';
const OTHER = '__other__';

interface OptionFieldProps {
  id: string;
  /** Accessible name of the free-text input shown for "Other…". */
  label: string;
  /** Empty for "Not set". */
  value: string;
  options: readonly CopyOption[];
  onChange: (value: string) => void;
  invalid?: boolean;
}

/**
 * A copy-details field: picks from the suggested options, or "Other…" for free text (every option
 * field accepts any value, FC-15).
 */
export function OptionField({ id, label, value, options, onChange, invalid }: OptionFieldProps) {
  const known = options.some((option) => option.value === value);
  const [other, setOther] = useState(value !== '' && !known);
  const selected = other ? OTHER : value === '' ? NONE : value;

  function select(next: string) {
    setOther(next === OTHER);
    onChange(next === OTHER || next === NONE ? '' : next);
  }

  return (
    <div className="flex flex-col gap-2">
      <Select value={selected} onValueChange={select}>
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not set</SelectItem>
          <SelectSeparator />
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={OTHER}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {other && (
        <Input
          aria-label={`${label} (other)`}
          placeholder="Type a value"
          value={value}
          maxLength={MAX_OPTION_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
        />
      )}
    </div>
  );
}
