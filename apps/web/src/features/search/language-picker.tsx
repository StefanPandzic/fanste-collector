'use client';

import { ChevronsUpDown, Star, X } from 'lucide-react';
import { useState } from 'react';

import { LANGUAGE_CODES, languageLabel } from '@fanste/core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface LanguagePickerProps {
  id: string;
  /** Field name, e.g. `Audio languages`, for the accessible names. */
  label: string;
  /** ISO 639 codes, in order. */
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Marks the first language as the main one and lets the user pick another (audio). */
  withMain?: boolean;
}

/** Searchable multi-select of languages, shown by name (`Intl.DisplayNames`), stored as codes. */
export function LanguagePicker({ id, label, value, onChange, withMain }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  // Codes stored earlier that the list doesn't offer stay selectable.
  const codes = [...new Set<string>([...LANGUAGE_CODES, ...value])];

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter((entry) => entry !== code) : [...value, code]);
  }

  function makeMain(code: string) {
    onChange([code, ...value.filter((entry) => entry !== code)]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value.length === 0 ? 'Choose languages' : `${value.length} selected`}
            <ChevronsUpDown aria-hidden className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search languages" />
            <CommandList>
              <CommandEmpty>No language found.</CommandEmpty>
              <CommandGroup>
                {codes.map((code) => (
                  <CommandItem
                    key={code}
                    value={`${languageLabel(code)} ${code}`}
                    onSelect={() => toggle(code)}
                    data-checked={value.includes(code)}
                  >
                    {languageLabel(code)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {value.map((code, index) => {
            const name = languageLabel(code);
            const main = withMain && index === 0;
            return (
              <li key={code}>
                <Badge variant="secondary" className="gap-1 pr-0.5">
                  {name}
                  {main && <span className="text-muted-foreground">· main</span>}
                  {withMain && !main && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => makeMain(code)}
                      aria-label={`Make ${name} the main language`}
                      title="Make main"
                    >
                      <Star aria-hidden />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggle(code)}
                    aria-label={`Remove ${name}`}
                  >
                    <X aria-hidden />
                  </Button>
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
