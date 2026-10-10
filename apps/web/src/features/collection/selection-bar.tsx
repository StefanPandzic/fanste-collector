'use client';

import { ChevronDown, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { OWNERSHIP_STATUSES, ownershipLabel } from '@fanste/core';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { OwnershipStatus, Tag } from '@fanste/core';

interface SelectionBarProps {
  count: number;
  /** Whether every loaded item is selected. */
  allSelected: boolean;
  tags: readonly Tag[];
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  onSetOwnership: (status: OwnershipStatus) => void;
  onAddTag: (tagId: string) => void;
}

function items(count: number): string {
  return `${count.toLocaleString()} item${count === 1 ? '' : 's'}`;
}

/** Bulk actions for the selected items, pinned to the bottom of the window (FC-18). */
export function SelectionBar({
  count,
  allSelected,
  tags,
  onSelectAll,
  onClear,
  onDelete,
  onSetOwnership,
  onAddTag,
}: SelectionBarProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      role="toolbar"
      aria-label="Selected items"
      className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
    >
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
        <X aria-hidden />
      </Button>
      <span className="px-1 text-sm font-medium" role="status">
        {items(count)} selected
      </span>
      {!allSelected && (
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
          Select all
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Set status
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {OWNERSHIP_STATUSES.map((status) => (
            <DropdownMenuItem key={status} onSelect={() => onSetOwnership(status)}>
              {ownershipLabel(status)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <TagIcon aria-hidden />
            Add tag
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72">
          {tags.length === 0 ? (
            // Tags are created on the item page (FC-19).
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              No tags yet
            </DropdownMenuLabel>
          ) : (
            tags.map((tag) => (
              <DropdownMenuItem key={tag.id} onSelect={() => onAddTag(tag.id)}>
                {tag.color && (
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden />
        Delete
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {items(count)}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are removed from your collection on all your devices, with their copy details,
              notes and tags. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
