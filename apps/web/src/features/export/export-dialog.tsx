'use client';

import { FileDown, Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  CollectionError,
  collectionErrorMessage,
  useCollectionFacets,
  useCustomCollections,
  useLoadExportItems,
  useTags,
} from '@fanste/collection';
import {
  buildCollectionExport,
  EXPORT_SORT_LABELS,
  EXPORT_SORTS,
  exportTargets,
  targetsOfItems,
} from '@fanste/export';

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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { saveFile } from '@/lib/save-file';

import { baseFilterOf, exportLoadScope, progressLabel, sourceDescription } from './export-view';

import type { ExportSource } from './export-view';
import type { ExportProgress } from '@fanste/collection';
import type { ExportGroupKey, ExportLayout, ExportSort } from '@fanste/export';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ExportSource;
}

const LAYOUT_OPTIONS: { value: ExportLayout; label: string; description: string }[] = [
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

/**
 * Exports part of the collection as CSV (FC-25): pick the categories and custom collections, one
 * file or one per category, and the order. The file is built in the browser; only the items are
 * loaded from the server.
 */
export function ExportDialog({ open, onOpenChange, source }: ExportDialogProps) {
  const id = useId();
  const [layout, setLayout] = useState<ExportLayout>('single');
  const [sort, setSort] = useState<ExportSort>('category');
  const [includeOriginal, setIncludeOriginal] = useState(false);
  // Unticked groups, so groups that appear later (counts loading) start ticked.
  const [excluded, setExcluded] = useState<ReadonlySet<ExportGroupKey>>(new Set());
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const abort = useRef<AbortController | null>(null);

  const base = baseFilterOf(source);
  // A selection counts its own items.
  const facets = useCollectionFacets(base, { enabled: source.kind !== 'selection' });
  const tags = useTags();
  const collections = useCustomCollections();
  const loadItems = useLoadExportItems();

  const targets =
    source.kind === 'selection'
      ? targetsOfItems(source.items, collections.data ?? [])
      : facets.data
        ? exportTargets(facets.data, collections.data ?? [], base)
        : [];
  const picked = new Set(
    targets.filter((target) => !excluded.has(target.key)).map((target) => target.key),
  );
  const pickedCount = targets
    .filter((target) => picked.has(target.key))
    .reduce((sum, target) => sum + target.count, 0);
  const total = targets.reduce((sum, target) => sum + target.count, 0);
  const ready = tags.isSuccess && collections.isSuccess && targets.length > 0;
  const running = progress !== null;

  // Closing the dialog (or leaving the page) stops a running export.
  useEffect(() => {
    if (!open) abort.current?.abort();
  }, [open]);
  useEffect(() => () => abort.current?.abort(), []);

  function toggle(key: ExportGroupKey, checked: boolean) {
    const next = new Set(excluded);
    if (checked) next.delete(key);
    else next.add(key);
    setExcluded(next);
  }

  async function runExport() {
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ phase: 'items', loaded: 0, total: pickedCount });
    try {
      const { items, missingMetadata } = await loadItems(exportLoadScope(source, targets, picked), {
        onProgress: setProgress,
        signal: controller.signal,
      });
      const file = buildCollectionExport(items, {
        layout,
        sort,
        includeOriginal,
        tags: tags.data ?? [],
        collections: collections.data ?? [],
        date: new Date(),
      });
      controller.signal.throwIfAborted();
      if (await saveFile(file)) {
        toast.success(`Exported ${items.length.toLocaleString()} items to ${file.name}`);
        if (missingMetadata > 0) {
          toast.warning(
            `${missingMetadata.toLocaleString()} items were exported without their provider details (title, year, link): the provider was busy or no longer has them.`,
          );
        }
        onOpenChange(false);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(
        error instanceof CollectionError
          ? collectionErrorMessage(error)
          : "The export couldn't be saved. Please try again.",
      );
    } finally {
      if (abort.current === controller) abort.current = null;
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export to CSV</DialogTitle>
          <DialogDescription>
            {sourceDescription(source, facets.data ? total : undefined)} The file opens in Excel,
            Google Sheets and Numbers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2" disabled={running}>
            <legend className="mb-2 text-sm font-medium">What to export</legend>
            {targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {facets.isPending || collections.isPending ? 'Loading…' : 'Nothing to export.'}
              </p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {targets.map((target) => (
                  <li key={target.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`${id}-${target.key}`}
                      checked={picked.has(target.key)}
                      onCheckedChange={(checked) => toggle(target.key, checked === true)}
                    />
                    <Label htmlFor={`${id}-${target.key}`} className="flex-1 font-normal">
                      {target.label}
                    </Label>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {target.count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-2" disabled={running}>
            <legend className="mb-2 text-sm font-medium">File</legend>
            {LAYOUT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 has-checked:border-primary has-checked:bg-accent"
              >
                <input
                  type="radio"
                  name={`${id}-layout`}
                  value={option.value}
                  checked={layout === option.value}
                  onChange={() => setLayout(option.value)}
                  className="mt-1 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-sm text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-sort`}>Order</Label>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as ExportSort)}
              disabled={running}
            >
              <SelectTrigger id={`${id}-sort`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_SORTS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {EXPORT_SORT_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id={`${id}-original`}
              checked={includeOriginal}
              onCheckedChange={(checked) => setIncludeOriginal(checked === true)}
              disabled={running}
              className="mt-0.5"
            />
            <Label htmlFor={`${id}-original`} className="flex flex-col items-start gap-0.5">
              <span>Include original values</span>
              <span className="font-normal text-muted-foreground">
                Adds the provider&apos;s title, subtitle and year next to the ones you edited.
              </span>
            </Label>
          </div>
        </div>

        <DialogFooter className="items-center">
          {progress && (
            <p role="status" className="mr-auto text-sm text-muted-foreground">
              {progressLabel(progress)}
            </p>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void runExport()}
            disabled={!ready || picked.size === 0 || running}
          >
            {running ? <Loader2 aria-hidden className="animate-spin" /> : <FileDown aria-hidden />}
            {running ? 'Exporting…' : `Export ${pickedCount.toLocaleString()} items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
