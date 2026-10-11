'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { EyeOff, FolderX, Search, Undo2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  useCollectionContext,
  useCollectionItem,
  useFixScannedFiles,
  useItemScannedFiles,
} from '@fanste/collection';
import { filesInFolder, fixGroup, folderKeyOf } from '@fanste/core';

import { CoverImage } from '@/components/items/cover-image';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import {
  advanceSession,
  candidateKey,
  candidateRef,
  confidenceLabel,
  fixCandidates,
  fixSummary,
  initialSearch,
  moveIndex,
  removesCurrentItem,
  searchYear,
} from './fix-match-view';
import { useScanMatcherContext } from './scan-matcher-provider';
import { fileName, parentFolder, parsedLabel, STATUS_LABELS } from './scanner-view';

import type { FixCandidate, FixSearch, FixSession } from './fix-match-view';
import type { ScannedFile, ScannedFileFix, ScannedFileFixResult } from '@fanste/collection';
import type { ItemRef } from '@fanste/core';
import type { KeyboardEvent } from 'react';

interface FixMatchDialogProps {
  /** The open session; `null` closes the dialog. */
  session: FixSession | null;
  onSessionChange: (session: FixSession | null) => void;
  /**
   * The files the session's IDs come from. A fix can also apply to the other files here that the
   * matcher would have matched with the current one (`fixGroup`), and "Ignore folder" to the files
   * in its folder.
   */
  files: readonly ScannedFile[];
  /** After each fix, e.g. for the item page to follow the files to their new item. */
  onFixed?: (result: ScannedFileFixResult, fix: ScannedFileFix['kind']) => void;
  /**
   * Offers "Ignore folder". Only where `files` is the device's whole list (the scanner page), so the
   * folder's files are all there.
   */
  folderIgnore?: boolean;
}

/**
 * "Fix Match" (FC-24): pick the right TMDB title for a scanned file, from the matcher's suggestions
 * (FC-23) or a manual search, or ignore the file or its folder. ↑/↓ choose, Enter confirms, and the
 * next file of the session opens on its own.
 */
export function FixMatchDialog({
  session,
  onSessionChange,
  files,
  onFixed,
  folderIgnore = false,
}: FixMatchDialogProps) {
  const file = session ? files.find((entry) => entry.id === session.currentId) : undefined;
  const missing = session !== null && file === undefined;

  // The file left the list (removed by a scan, fixed elsewhere): end the session, so it doesn't
  // reopen if the file comes back.
  useEffect(() => {
    if (missing) onSessionChange(null);
  }, [missing, onSessionChange]);

  return (
    <Dialog open={file !== undefined} onOpenChange={(open) => !open && onSessionChange(null)}>
      <DialogContent
        className="flex max-h-[90svh] flex-col gap-0 p-0 sm:max-w-2xl"
        // The body focuses the list of titles itself.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {file && session && (
          <FixMatchBody
            // Fresh search and highlight for every file.
            key={file.id}
            file={file}
            files={files}
            next={(handledIds) => onSessionChange(advanceSession(session, handledIds))}
            onFixed={onFixed}
            folderIgnore={folderIgnore}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FixMatchBodyProps {
  file: ScannedFile;
  files: readonly ScannedFile[];
  /** Moves on to the next file of the session (or closes the dialog). */
  next: (handledIds: readonly string[]) => void;
  onFixed: FixMatchDialogProps['onFixed'];
  folderIgnore: boolean;
}

function FixMatchBody({ file, files, next, onFixed, folderIgnore }: FixMatchBodyProps) {
  const { api } = useCollectionContext();
  const fixFiles = useFixScannedFiles();
  const matcher = useScanMatcherContext();
  const listId = useId();
  const groupId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState<FixSearch>(() => initialSearch(file));
  const [submitted, setSubmitted] = useState<FixSearch | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [applyToGroup, setApplyToGroup] = useState(true);
  const [confirmFolder, setConfirmFolder] = useState(false);

  // The list takes the keys (↑/↓, Enter) from the start, also when the next file opens.
  useEffect(() => {
    listRef.current?.focus();
  }, []);

  const results = useQuery({
    queryKey: ['fix-match-search', submitted],
    queryFn: ({ signal }) => {
      const year = submitted ? searchYear(submitted.year) : undefined;
      return api.search(
        {
          category: submitted?.kind ?? 'movie',
          q: submitted?.title.trim() ?? '',
          ...(year !== undefined ? { year } : {}),
        },
        { signal },
      );
    },
    enabled: submitted !== null && submitted.title.trim() !== '',
    staleTime: 10 * 60 * 1000,
  });

  const candidates = useMemo(
    () => fixCandidates(file.matchCandidates, results.data?.results),
    [file.matchCandidates, results.data],
  );
  const selected = candidates[highlight];

  // Overviews come with the full items: one batch call for the list shown.
  const refs = useMemo(
    () => candidates.flatMap(({ item }) => candidateRef(item) ?? []),
    [candidates],
  );
  const details = useQuery({
    queryKey: ['fix-match-overviews', refs.map((ref) => `${ref.provider}:${ref.externalId}`)],
    queryFn: ({ signal }) => api.getItemsBatch(refs, { signal }),
    enabled: refs.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  const overviews = useMemo(
    () =>
      new Map(
        (details.data?.items ?? []).map((item) => [candidateKey(item), item.description] as const),
      ),
    [details.data],
  );

  const group = useMemo(() => fixGroup(file, files), [file, files]);
  const targets = applyToGroup ? group : [file];
  const folderFiles = useMemo(
    () =>
      filesInFolder(file.deviceId, folderKeyOf(file.pathKey), files).filter(
        (entry) => entry.matchStatus !== 'ignored',
      ),
    [file.deviceId, file.pathKey, files],
  );

  // What the files are linked to now, and whether the fix deletes it.
  const current = useCollectionItem(file.collectionItemId ?? undefined);
  const linked = useItemScannedFiles(file.collectionItemId ?? undefined);
  const currentTitle =
    current.data?.metadataOverrides.title ?? current.data?.metadata?.title ?? undefined;
  const currentRef = current.data?.externalId
    ? `${current.data.provider}:${current.data.externalId}`
    : undefined;
  const removesCurrent =
    file.collectionItemId !== null &&
    linked.data !== undefined &&
    removesCurrentItem({
      itemSource: current.data?.source,
      linked: linked.data,
      fixedIds: targets.map((entry) => entry.id),
    });

  async function apply(fix: ScannedFileFix, title?: string) {
    try {
      const result = await fixFiles.mutateAsync(fix);
      toast.success(fixSummary(fix.kind, result, title));
      if (fix.kind === 'restore') matcher?.start();
      onFixed?.(result, fix.kind);
      next(result.files.map((entry) => entry.id));
    } catch {
      // `useFixScannedFiles` reports the error; the dialog stays on this file.
    }
  }

  function confirm(candidate: FixCandidate | undefined = selected) {
    const ref: ItemRef | undefined = candidate && candidateRef(candidate.item);
    if (!ref || fixFiles.isPending) return;
    void apply({ kind: 'link', files: targets, ref }, candidate?.item.title);
  }

  function onKeyDown(event: KeyboardEvent) {
    // Keys from the folder confirm (a portal: its events bubble here) aren't the list's.
    if (confirmFolder || !event.currentTarget.contains(event.target as Node)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) =>
        moveIndex(index, event.key === 'ArrowDown' ? 1 : -1, candidates.length),
      );
      listRef.current?.focus();
    } else if (event.key === 'Enter' && event.target === listRef.current) {
      event.preventDefault();
      // A held Enter must not confirm the files that open after this one.
      if (!event.repeat) confirm();
    }
  }

  const searching = results.isFetching;
  const groupOthers = group.length - 1;

  return (
    <div className="flex min-h-0 flex-col" onKeyDown={onKeyDown}>
      <DialogHeader className="gap-1 border-b p-4 pr-12">
        <DialogTitle>Fix match</DialogTitle>
        <DialogDescription className="flex flex-col gap-0.5">
          <span className="truncate font-medium text-foreground" title={file.filePath}>
            {fileName(file.filePath)}
          </span>
          <span className="truncate text-caption">{parentFolder(file.filePath)}</span>
          <span className="flex flex-wrap items-center gap-2 pt-1">
            <span>Parsed as {parsedLabel(file)}</span>
            <Badge variant="outline">{STATUS_LABELS[file.matchStatus]}</Badge>
            {currentTitle && <span>Linked to {currentTitle}</span>}
          </span>
        </DialogDescription>
      </DialogHeader>

      <form
        className="flex flex-wrap items-end gap-2 border-b p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted({ ...search });
          setHighlight((file.matchCandidates ?? []).length);
        }}
      >
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor={`${listId}-title`}>Title</Label>
          <Input
            id={`${listId}-title`}
            value={search.title}
            onChange={(event) => setSearch({ ...search, title: event.target.value })}
          />
        </div>
        <div className="flex w-20 flex-col gap-1">
          <Label htmlFor={`${listId}-year`}>Year</Label>
          <Input
            id={`${listId}-year`}
            inputMode="numeric"
            value={search.year}
            onChange={(event) => setSearch({ ...search, year: event.target.value })}
          />
        </div>
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Kind">
          {(['movie', 'tv'] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={search.kind === kind ? 'secondary' : 'ghost'}
              aria-pressed={search.kind === kind}
              onClick={() => setSearch({ ...search, kind })}
            >
              {kind === 'movie' ? 'Movie' : 'TV'}
            </Button>
          ))}
        </div>
        <Button type="submit" variant="outline" disabled={search.title.trim() === '' || searching}>
          <Search aria-hidden />
          Search
        </Button>
      </form>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Titles"
        aria-activedescendant={selected ? `${listId}-${highlight}` : undefined}
        tabIndex={0}
        className="flex min-h-40 flex-1 flex-col gap-1 overflow-y-auto p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {candidates.length === 0 && !searching && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {results.isError
              ? "The search didn't work. Try again in a moment."
              : submitted
                ? 'No titles found. Try another title, year or kind.'
                : 'No suggestions. Search TMDB above.'}
          </p>
        )}
        {candidates.map((candidate, index) => {
          const key = candidateKey(candidate.item);
          const overview = overviews.get(key);
          return (
            <div
              key={key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              onClick={() => {
                setHighlight(index);
                listRef.current?.focus();
              }}
              onDoubleClick={() => confirm(candidate)}
              className={cn(
                'flex cursor-pointer gap-3 rounded-md p-2 text-sm',
                index === highlight ? 'bg-muted ring-1 ring-ring/40' : 'hover:bg-muted/60',
              )}
            >
              <div className="w-12 shrink-0">
                <CoverImage
                  src={candidate.item.thumbnailUrl}
                  alt=""
                  category={candidate.item.category}
                  sizes="48px"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {candidate.item.title}
                  {candidate.item.releaseYear !== undefined && (
                    <span className="font-normal text-muted-foreground">
                      {candidate.item.releaseYear}
                    </span>
                  )}
                  <Badge variant="outline">
                    {candidate.item.category === 'tv' ? 'TV' : 'Movie'}
                  </Badge>
                  {candidate.confidence !== undefined && (
                    <Badge variant="secondary">
                      Suggested · {confidenceLabel(candidate.confidence)}
                    </Badge>
                  )}
                  {currentRef === key && <Badge>Current match</Badge>}
                </p>
                {overview ? (
                  <p className="line-clamp-2 text-muted-foreground">{overview}</p>
                ) : details.isPending ? (
                  <Skeleton className="h-4 w-3/4" />
                ) : null}
              </div>
            </div>
          );
        })}
        {searching && <Skeleton className="m-2 h-16" aria-label="Searching" />}
      </div>

      <div className="flex flex-col gap-2 border-t p-4 text-sm">
        {groupOthers > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              id={groupId}
              checked={applyToGroup}
              onCheckedChange={(checked) => setApplyToGroup(checked === true)}
            />
            <Label htmlFor={groupId} className="font-normal">
              Also fix {groupOthers.toLocaleString()} other {groupOthers === 1 ? 'file' : 'files'}{' '}
              of this title
            </Label>
          </div>
        )}
        {removesCurrent && currentTitle && (
          <p className="text-muted-foreground">
            The scanner added {currentTitle} for{' '}
            {targets.length === 1 ? 'this file' : 'these files'} only. Unless you pick it again, it
            is removed from your collection.
          </p>
        )}
      </div>

      <DialogFooter className="flex-wrap gap-2 border-t p-4 sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {file.matchStatus === 'ignored' ? (
            <Button
              variant="outline"
              disabled={fixFiles.isPending}
              onClick={() => void apply({ kind: 'restore', files: [file] })}
            >
              <Undo2 aria-hidden />
              Match again
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={fixFiles.isPending}
                onClick={() => void apply({ kind: 'ignore', files: targets })}
              >
                <EyeOff aria-hidden />
                Ignore {targets.length > 1 ? `${targets.length} files` : 'file'}
              </Button>
              {folderIgnore && (
                <Button
                  variant="outline"
                  disabled={fixFiles.isPending || folderFiles.length === 0}
                  onClick={() => setConfirmFolder(true)}
                >
                  <FolderX aria-hidden />
                  Ignore folder
                </Button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => next([])}>
            Skip
          </Button>
          <Button disabled={!selected || fixFiles.isPending} onClick={() => confirm()}>
            Confirm
          </Button>
        </div>
      </DialogFooter>

      <AlertDialog open={confirmFolder} onOpenChange={setConfirmFolder}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignore this folder?</AlertDialogTitle>
            <AlertDialogDescription>
              {folderFiles.length.toLocaleString()} {folderFiles.length === 1 ? 'file' : 'files'} in{' '}
              {parentFolder(file.filePath)} and its subfolders are ignored. Items the scanner added
              only for them are removed. Files added to the folder later are matched as usual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void apply({ kind: 'ignore', files: folderFiles })}>
              Ignore folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
