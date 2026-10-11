'use client';

import { Check, EyeOff, Undo2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface FileSelectionBarProps {
  count: number;
  /** Selected files with a stored suggestion. */
  withSuggestion: number;
  /** Selected files that are ignored, and that aren't. */
  ignored: number;
  notIgnored: number;
  busy: boolean;
  onClear: () => void;
  onAccept: () => void;
  onIgnore: () => void;
  onRestore: () => void;
}

/** Bulk Fix Match actions for the selected scanned files (FC-24), pinned to the bottom. */
export function FileSelectionBar({
  count,
  withSuggestion,
  ignored,
  notIgnored,
  busy,
  onClear,
  onAccept,
  onIgnore,
  onRestore,
}: FileSelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Selected files"
      className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg"
    >
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
        <X aria-hidden />
      </Button>
      <span className="px-1 text-sm font-medium" role="status">
        {count.toLocaleString()} {count === 1 ? 'file' : 'files'} selected
      </span>
      {notIgnored > 0 && (
        <>
          <Button size="sm" disabled={busy || withSuggestion === 0} onClick={onAccept}>
            <Check aria-hidden />
            Accept top suggestion
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={onIgnore}>
            <EyeOff aria-hidden />
            Ignore
          </Button>
        </>
      )}
      {ignored > 0 && (
        <Button variant="outline" size="sm" disabled={busy} onClick={onRestore}>
          <Undo2 aria-hidden />
          Match again
        </Button>
      )}
    </div>
  );
}
