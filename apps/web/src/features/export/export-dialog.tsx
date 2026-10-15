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
  defaultPaperSize,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDisplayName } from '@/features/profile/profile-name-provider';
import { saveFile } from '@/lib/save-file';

import { CsvOptions, PdfOptions } from './export-options';
import {
  baseFilterOf,
  exportLoadScope,
  pdfSource,
  progressLabel,
  sourceDescription,
} from './export-view';

import type { CsvSettings, PdfSettings } from './export-options';
import type { ExportDialogProgress, ExportFormat, ExportSource } from './export-view';
import type { ExportFile, ExportGroupKey } from '@fanste/export';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ExportSource;
  /** The format the dialog opens with; the user can switch. */
  initialFormat?: ExportFormat;
}

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  csv: 'The file opens in Excel, Google Sheets and Numbers.',
  pdf: 'A print-ready catalog for sharing, insurance and archiving.',
};

/**
 * Exports part of the collection as CSV (FC-25) or as a PDF catalog (FC-26): pick the categories and
 * custom collections and the format's options. The file is built in the browser; only the items
 * (and for a PDF the covers) are loaded from the network.
 */
export function ExportDialog({
  open,
  onOpenChange,
  source,
  initialFormat = 'csv',
}: ExportDialogProps) {
  const id = useId();
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [csv, setCsv] = useState<CsvSettings>({
    layout: 'single',
    sort: 'category',
    includeOriginal: false,
  });
  const [pdf, setPdf] = useState<PdfSettings>(() => ({
    layout: 'grid',
    paper: defaultPaperSize(typeof navigator === 'undefined' ? undefined : navigator.language),
    includePrices: true,
  }));
  // Unticked groups, so groups that appear later (counts loading) start ticked.
  const [excluded, setExcluded] = useState<ReadonlySet<ExportGroupKey>>(new Set());
  const [progress, setProgress] = useState<ExportDialogProgress | null>(null);
  const abort = useRef<AbortController | null>(null);
  const userName = useDisplayName();

  // The insurance list exports only the copies the user has; `null` when the filters leave none.
  const scoped = format === 'pdf' ? pdfSource(source, pdf.layout) : source;
  const base = scoped ? baseFilterOf(scoped) : {};
  // A selection counts its own items.
  const facets = useCollectionFacets(base, {
    enabled: scoped?.kind === 'filter' || scoped?.kind === 'all',
  });
  // Switching to the insurance list changes the filter; the previous counts are kept as
  // placeholder data until the new ones arrive, and would count wishlist and sold items.
  const counts = facets.isPlaceholderData ? undefined : facets.data;
  const tags = useTags();
  const collections = useCustomCollections();
  const loadItems = useLoadExportItems();

  const targets = !scoped
    ? []
    : scoped.kind === 'selection'
      ? targetsOfItems(scoped.items, collections.data ?? [])
      : counts
        ? exportTargets(counts, collections.data ?? [], base)
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
  const countsLoading =
    scoped?.kind !== 'selection' && scoped !== null && counts === undefined && !facets.isError;

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
    if (!scoped) return;
    const controller = new AbortController();
    abort.current = controller;
    setProgress({ phase: 'items', loaded: 0, total: pickedCount });
    try {
      const { items, missingMetadata } = await loadItems(exportLoadScope(scoped, targets, picked), {
        onProgress: setProgress,
        signal: controller.signal,
      });
      let file: ExportFile;
      let missingCovers = 0;
      if (format === 'csv') {
        file = buildCollectionExport(items, {
          ...csv,
          tags: tags.data ?? [],
          collections: collections.data ?? [],
          date: new Date(),
        });
      } else {
        // jsPDF loads only when a PDF is made.
        const { buildPdfExport } = await import('./pdf-export');
        ({ file, missingCovers } = await buildPdfExport(items, {
          ...pdf,
          collections: collections.data ?? [],
          userName,
          signal: controller.signal,
          onProgress: setProgress,
        }));
      }
      controller.signal.throwIfAborted();
      if (await saveFile(file)) {
        toast.success(`Exported ${items.length.toLocaleString()} items to ${file.name}`);
        if (missingMetadata > 0) {
          toast.warning(
            `${missingMetadata.toLocaleString()} items were exported without their provider details (title, year, link): the provider was busy or no longer has them.`,
          );
        }
        if (missingCovers > 0) {
          toast.warning(
            `${missingCovers.toLocaleString()} covers couldn't be loaded and show a placeholder in the PDF.`,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            {sourceDescription(source, scoped === source && counts ? total : undefined)}{' '}
            {FORMAT_DESCRIPTIONS[format]}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <Tabs value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
            <TabsList className="w-full">
              <TabsTrigger value="csv" disabled={running}>
                CSV spreadsheet
              </TabsTrigger>
              <TabsTrigger value="pdf" disabled={running}>
                PDF catalog
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <fieldset className="flex flex-col gap-2" disabled={running}>
            <legend className="mb-2 text-sm font-medium">What to export</legend>
            {targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {countsLoading || collections.isPending ? 'Loading…' : 'Nothing to export.'}
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

          {format === 'csv' ? (
            <CsvOptions settings={csv} onChange={setCsv} disabled={running} />
          ) : (
            <PdfOptions settings={pdf} onChange={setPdf} disabled={running} />
          )}
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
