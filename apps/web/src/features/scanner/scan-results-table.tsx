'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

import {
  fileName,
  filterFiles,
  formatFileSize,
  pageOf,
  parentFolder,
  parsedLabel,
  STATUS_LABELS,
  statusCounts,
} from './scanner-view';

import type { StatusFilter } from './scanner-view';
import type { ScannedFile } from '@fanste/collection';
import type { ScanMatchStatus } from '@fanste/core';

const STATUS_VARIANTS: Record<ScanMatchStatus, 'default' | 'secondary' | 'outline'> = {
  pending: 'outline',
  matched: 'default',
  manual: 'default',
  unmatched: 'secondary',
  ignored: 'outline',
};

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'matched', label: STATUS_LABELS.matched },
  { value: 'manual', label: STATUS_LABELS.manual },
  { value: 'unmatched', label: STATUS_LABELS.unmatched },
  { value: 'ignored', label: STATUS_LABELS.ignored },
];

interface ScanResultsTableProps {
  /** The current (not removed) files of this device. */
  files: readonly ScannedFile[];
}

/**
 * The scanned files with their parsed title and match status (FC-21). The title is filled in by
 * the filename parser (FC-22) and the status by matching (FC-23); one page of rows renders at a
 * time, so large libraries stay fast.
 */
export function ScanResultsTable({ files }: ScanResultsTableProps) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const counts = useMemo(() => statusCounts(files), [files]);
  const filtered = useMemo(() => filterFiles(files, status, search), [files, search, status]);
  const current = pageOf(filtered, page);

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
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </InputGroup>
      </div>

      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as StatusFilter);
          setPage(0);
        }}
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
            <TableHead>File</TableHead>
            <TableHead>Parsed title</TableHead>
            <TableHead className="text-right">Size</TableHead>
            <TableHead>Subtitles</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {current.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No files match.
              </TableCell>
            </TableRow>
          ) : (
            current.rows.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="max-w-96">
                  <p className="truncate font-medium" title={file.filePath}>
                    {fileName(file.filePath)}
                  </p>
                  <p className="truncate text-caption text-muted-foreground">
                    {parentFolder(file.filePath)}
                  </p>
                </TableCell>
                <TableCell>{parsedLabel(file)}</TableCell>
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
    </section>
  );
}
