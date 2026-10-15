'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { ExportDialog } from './export-dialog';

import type { ExportFormat, ExportSource } from './export-view';

const WHOLE_COLLECTION: ExportSource = { kind: 'all' };

/** The export page: the whole collection as CSV (FC-25) or as a PDF catalog (FC-26). */
export function ExportPageClient() {
  const [openFormat, setOpenFormat] = useState<ExportFormat | null>(null);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Download your collection. Files are made on your device. To export only some items, filter
          or select them in the collection and choose Export there.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet aria-hidden className="size-5" />
            CSV spreadsheet
          </CardTitle>
          <CardDescription>
            Every copy with its details, prices, tags and notes, as one file or one per category. A
            plain-text backup that opens in Excel, Google Sheets and Numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpenFormat('csv')}>Export to CSV…</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText aria-hidden className="size-5" />
            PDF catalog
          </CardTitle>
          <CardDescription>
            A print-ready catalog of cover art with titles and copy details, or an insurance list
            with purchase prices, estimated values and totals per category. On A4 or US Letter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpenFormat('pdf')}>Export to PDF…</Button>
        </CardContent>
      </Card>

      {/* Mounted only while open, so its queries don't run on page load. */}
      {openFormat && (
        <ExportDialog
          open
          onOpenChange={(open) => {
            if (!open) setOpenFormat(null);
          }}
          source={WHOLE_COLLECTION}
          initialFormat={openFormat}
        />
      )}
    </div>
  );
}
