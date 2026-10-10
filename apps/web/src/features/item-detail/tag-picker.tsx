'use client';

import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { useTagAssignment, useTagMutations, useTags } from '@fanste/collection';
import { MAX_TAG_NAME_LENGTH } from '@fanste/core';

import { TagChip } from '@/components/items/tag-chip';
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

interface TagPickerProps {
  itemId: string;
  /** The item's tags. */
  tagIds: readonly string[];
  disabled?: boolean;
}

/** The tags of a copy: remove them, pick existing ones, or create a new one by typing its name. */
export function TagPicker({ itemId, tagIds, disabled }: TagPickerProps) {
  const tags = useTags();
  const { assign, unassign } = useTagAssignment();
  const { create } = useTagMutations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const all = tags.data ?? [];
  const assigned = all.filter((tag) => tagIds.includes(tag.id));
  const name = query.trim().slice(0, MAX_TAG_NAME_LENGTH);
  const exists = all.some((tag) => tag.name.toLowerCase() === name.toLowerCase());

  function toggle(tagId: string) {
    if (tagIds.includes(tagId)) unassign.mutate({ itemId, tagId });
    else assign.mutate({ itemId, tagId });
  }

  function createAndAssign() {
    if (!name) return;
    setQuery('');
    // A failed create is reported by the collection provider's error toast.
    create.mutateAsync({ name }).then(
      (tag) => assign.mutate({ itemId, tagId: tag.id }),
      () => undefined,
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((tag) => (
        <TagChip
          key={tag.id}
          label={tag.name}
          onRemove={disabled ? undefined : () => unassign.mutate({ itemId, tagId: tag.id })}
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="xs" disabled={disabled}>
            <Plus aria-hidden />
            {assigned.length === 0 ? 'Add tag' : 'Tags'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Find or create a tag"
              value={query}
              onValueChange={setQuery}
              maxLength={MAX_TAG_NAME_LENGTH}
            />
            <CommandList>
              <CommandEmpty>{name ? 'No tag with that name.' : 'No tags yet.'}</CommandEmpty>
              {all.length > 0 && (
                <CommandGroup heading="Tags">
                  {all.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => toggle(tag.id)}
                      data-checked={tagIds.includes(tag.id)}
                    >
                      {tag.color && (
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span className="truncate">{tag.name}</span>
                      {tagIds.includes(tag.id) && <Check aria-hidden className="ml-auto" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {name && !exists && (
                <CommandGroup forceMount>
                  <CommandItem forceMount value={`create ${name}`} onSelect={createAndAssign}>
                    <Plus aria-hidden />
                    Create “{name}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
