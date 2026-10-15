'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { ExportDialog } from './export-dialog';

import type { ExportSource } from './export-view';

const WHOLE_COLLECTION: ExportSource = { kind: 'all' };

/** The export page (FC-25): CSV now, the PDF catalog in FC-26. */
export function ExportPageClient() {
  const [csvOpen, setCsvOpen] = useState(false);

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
          <Button onClick={() => setCsvOpen(true)}>Export to CSV…</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText aria-hidden className="size-5" />
            PDF catalog
          </CardTitle>
          <CardDescription>Coming soon (FC-26).</CardDescription>
        </CardHeader>
      </Card>

      {/* Mounted only while open, so its queries don't run on page load. */}
      {csvOpen && <ExportDialog open onOpenChange={setCsvOpen} source={WHOLE_COLLECTION} />}
    </div>
  );
}
