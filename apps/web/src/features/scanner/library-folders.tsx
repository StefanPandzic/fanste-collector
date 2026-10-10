'use client';

import { Folder, FolderPlus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { MIN_SIZE_OPTIONS_MB } from './scanner-view';

import type { LibraryFolder } from '@fanste/core';

interface LibraryFoldersProps {
  folders: readonly LibraryFolder[];
  /** Current files per folder, by path key. */
  fileCounts: ReadonlyMap<string, number>;
  /** A scan is running: folders can't be scanned or removed meanwhile. */
  busy: boolean;
  minSizeMb: number;
  onMinSizeChange: (value: number) => void;
  onAdd: () => void;
  onScan: (folder?: LibraryFolder) => void;
  onRemove: (folder: LibraryFolder) => void;
}

function sizeLabel(megabytes: number): string {
  return megabytes === 0 ? 'Every video' : `${megabytes.toLocaleString()} MB`;
}

/** The library folders on this computer, with add, rescan and remove (FC-21). */
export function LibraryFolders({
  folders,
  fileCounts,
  busy,
  minSizeMb,
  onMinSizeChange,
  onAdd,
  onScan,
  onRemove,
}: LibraryFoldersProps) {
  const [removing, setRemoving] = useState<LibraryFolder | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Library folders</CardTitle>
        <CardDescription>
          Folders on this computer with your movies and TV shows. Subfolders are scanned too.
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2">
          {folders.length > 0 && (
            <Button variant="outline" disabled={busy} onClick={() => onScan()}>
              <RefreshCw aria-hidden />
              Scan all
            </Button>
          )}
          <Button disabled={busy} onClick={onAdd}>
            <FolderPlus aria-hidden />
            Add folders
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {folders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No folders yet. Add the folders that hold your video files.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {folders.map((folder) => {
              const count = fileCounts.get(folder.pathKey) ?? 0;
              return (
                <li key={folder.pathKey} className="flex items-center gap-3 px-3 py-2">
                  <Folder aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={folder.path}>
                      {folder.path}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {count.toLocaleString()} {count === 1 ? 'video' : 'videos'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Rescan ${folder.path}`}
                    onClick={() => onScan(folder)}
                  >
                    <RefreshCw aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Remove ${folder.path}`}
                    onClick={() => setRemoving(folder)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="scanner-min-size" className="text-sm text-muted-foreground">
            Skip videos smaller than
          </Label>
          <Select
            value={String(minSizeMb)}
            onValueChange={(value) => onMinSizeChange(Number(value))}
            disabled={busy}
          >
            <SelectTrigger id="scanner-min-size" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MIN_SIZE_OPTIONS_MB.map((megabytes) => (
                <SelectItem key={megabytes} value={String(megabytes)}>
                  {sizeLabel(megabytes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>

      <AlertDialog
        open={removing !== undefined}
        onOpenChange={(open) => !open && setRemoving(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this folder from the library?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.path} is no longer scanned and its videos leave the scanner list. The files
              stay on your computer, and items already in your collection stay there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing) onRemove(removing);
                setRemoving(undefined);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
