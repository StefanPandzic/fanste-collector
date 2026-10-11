'use client';

import { ChevronLeft, ChevronRight, Search, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useFixScannedFiles } from '@fanste/collection';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { FileSelectionBar } from './file-selection-bar';
import { FixMatchDialog } from './fix-match-dialog';
import { fixSummary } from './fix-match-view';
import { useScanMatcherContext } from './scan-matcher-provider';
import {
  defaultStatusFilter,
  fileName,
  filterFiles,
  formatFileSize,
  pageOf,
  parentFolder,
  parsedLabel,
  qualityLabel,
  STATUS_LABELS,
  statusCounts,
} from './scanner-view';

import type { FixSession } from './fix-match-view';
import type { StatusFilter } from './scanner-view';
import type { ScannedFile, ScannedFileFix } from '@fanste/collection';
import type { ScanMatchStatus } from '@fanste/core';

const STATUS_VARIANTS: Record<ScanMatchStatus, 'default' | 'secondary' | 'outline'> = {
  pending: 'outline',
  matched: 'default',
  manual: 'default',
  unmatched: 'secondary',
  ignored: 'outline',
};

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'unmatched', label: STATUS_LABELS.unmatched },
  { value: 'all', label: 'All' },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'matched', label: STATUS_LABELS.matched },
  { value: 'manual', label: STATUS_LABELS.manual },
  { value: 'ignored', label: STATUS_LABELS.ignored },
];

interface ScanResultsTableProps {
  /** The current (not removed) files of this device. */
  files: readonly ScannedFile[];
}

/**
 * The scanned files with their parsed title, detected quality and match status (FC-21). The title
 * comes from the filename parser and the quality from the files' headers (FC-22), the status from
 * matching (FC-23); one page of rows renders at a time, so large libraries stay fast. Files can be
 * fixed one by one ("Fix match") or in bulk from the selection (FC-24); the table opens on "Needs
 * review" while there is something to review.
 */
export function ScanResultsTable({ files }: ScanResultsTableProps) {
  const [status, setStatus] = useState<StatusFilter>(() => defaultStatusFilter(files));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [session, setSession] = useState<FixSession | null>(null);
  const fixFiles = useFixScannedFiles();
  const matcher = useScanMatcherContext();

  const counts = useMemo(() => statusCounts(files), [files]);
  const filtered = useMemo(() => filterFiles(files, status, search), [files, search, status]);
  const current = pageOf(filtered, page);
  // Only files still in the list count, so a fix that moves files to another tab drops them.
  const selected = useMemo(
    () => filtered.filter((file) => selectedIds.has(file.id)),
    [filtered, selectedIds],
  );
  const pageSelected =
    current.rows.length > 0 && current.rows.every((file) => selectedIds.has(file.id));

  function changeView(next: () => void) {
    next();
    setPage(0);
    setSelectedIds(new Set());
  }

  function toggle(id: string, on: boolean) {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulk(fix: ScannedFileFix) {
    try {
      const result = await fixFiles.mutateAsync(fix);
      toast.success(fixSummary(fix.kind, result));
      if (fix.kind === 'restore') matcher?.start();
      setSelectedIds(new Set());
    } catch {
      // `useFixScannedFiles` reports the error.
    }
  }

  const notIgnored = selected.filter((file) => file.matchStatus !== 'ignored');
  const ignored = selected.filter((file) => file.matchStatus === 'ignored');

  return (
    <section className="flex flex-col gap-3" aria-labelledby="scan-results-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="scan-results-heading" className="text-heading">
          Files
        </h2>
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search files"
            placeholder="Search files"
            value={search}
            onChange={(event) => changeView(() => setSearch(event.target.value))}
          />
        </InputGroup>
      </div>

      <Tabs
        value={status}
        onValueChange={(value) => changeView(() => setStatus(value as StatusFilter))}
      >
        <TabsList className="flex-wrap">
          {FILTERS.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label}
              <span className="text-muted-foreground tabular-nums">
                {counts[filter.value].toLocaleString()}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Table aria-label="Scanned files">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                aria-label="Select the files on this page"
                checked={pageSelected}
                disabled={current.rows.length === 0}
                onCheckedChange={(checked) =>
                  setSelectedIds((ids) => {
                    const next = new Set(ids);
                    for (const file of current.rows) {
                      if (checked === true) next.add(file.id);
                      else next.delete(file.id);
                    }
                    return next;
                  })
                }
              />
            </TableHead>
            <TableHead>File</TableHead>
            <TableHead>Parsed title</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead className="text-right">Size</TableHead>
            <TableHead>Subtitles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {current.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                No files match.
              </TableCell>
            </TableRow>
          ) : (
            current.rows.map((file) => (
              <TableRow
                key={file.id}
                data-state={selectedIds.has(file.id) ? 'selected' : undefined}
              >
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${fileName(file.filePath)}`}
                    checked={selectedIds.has(file.id)}
                    onCheckedChange={(checked) => toggle(file.id, checked === true)}
                  />
                </TableCell>
                <TableCell className="max-w-96">
                  <p className="truncate font-medium" title={file.filePath}>
                    {fileName(file.filePath)}
                  </p>
                  <p className="truncate text-caption text-muted-foreground">
                    {parentFolder(file.filePath)}
                  </p>
                </TableCell>
                <TableCell>{parsedLabel(file)}</TableCell>
                <TableCell className="whitespace-nowrap">{qualityLabel(file)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatFileSize(file.size)}
                </TableCell>
                <TableCell className="uppercase">
                  {file.subtitleLanguages.length > 0 ? file.subtitleLanguages.join(', ') : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[file.matchStatus]}>
                    {STATUS_LABELS[file.matchStatus]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSession({
                        queue: filtered.map((entry) => entry.id),
                        currentId: file.id,
                        done: [],
                      })
                    }
                  >
                    <Wand2 aria-hidden />
                    Fix match
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {current.pageCount > 1 && (
        <nav className="flex items-center justify-end gap-2" aria-label="Pages">
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {current.page + 1} of {current.pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={current.page === 0}
            onClick={() => setPage(current.page - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={current.page >= current.pageCount - 1}
            onClick={() => setPage(current.page + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}

      {selected.length > 0 && (
        <FileSelectionBar
          count={selected.length}
          withSuggestion={notIgnored.filter((file) => file.matchCandidates?.length).length}
          ignored={ignored.length}
          notIgnored={notIgnored.length}
          busy={fixFiles.isPending}
          onClear={() => setSelectedIds(new Set())}
          onAccept={() => void bulk({ kind: 'accept', files: notIgnored })}
          onIgnore={() => void bulk({ kind: 'ignore', files: notIgnored })}
          onRestore={() => void bulk({ kind: 'restore', files: ignored })}
        />
      )}

      <FixMatchDialog session={session} onSessionChange={setSession} files={files} folderIgnore />
    </section>
  );
}
