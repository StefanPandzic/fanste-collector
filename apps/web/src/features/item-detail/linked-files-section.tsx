'use client';

import { FileVideo, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useItemScannedFiles } from '@fanste/collection';

import { Button } from '@/components/ui/button';
import { FixMatchDialog } from '@/features/scanner/fix-match-dialog';
import type { FixSession } from '@/features/scanner/fix-match-view';
import { currentFiles, fileName, parentFolder } from '@/features/scanner/scanner-view';

import type { ScannedFileFixResult } from '@fanste/collection';
import type { Route } from 'next';

interface LinkedFilesSectionProps {
  itemId: string;
  /** The fix deleted this item: the page is about to navigate away. */
  onLeave: () => void;
}

/**
 * The scanned files linked to this copy (FC-24), on any device, each with a "Fix match" shortcut.
 * Hidden when no file is linked. When a fix moves every file away and the item was only the
 * scanner's, the item is deleted and the page follows the files to their new item.
 */
export function LinkedFilesSection({ itemId, onLeave }: LinkedFilesSectionProps) {
  const router = useRouter();
  const linked = useItemScannedFiles(itemId);
  const files = useMemo(() => currentFiles(linked.data ?? []), [linked.data]);
  const [session, setSession] = useState<FixSession | null>(null);

  function onFixed(result: ScannedFileFixResult) {
    if (!result.removedItemIds.includes(itemId)) return;
    setSession(null);
    onLeave();
    router.push(result.itemId ? (`/collection/${result.itemId}` as Route) : '/collection');
  }

  if (files.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="linked-files-heading">
      <h2 id="linked-files-heading" className="text-heading">
        Files
      </h2>
      <ul className="flex flex-col divide-y rounded-lg border">
        {files.map((file) => (
          <li key={file.id} className="flex items-center gap-3 p-3">
            <FileVideo aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.filePath}>
                {fileName(file.filePath)}
              </p>
              <p className="truncate text-caption text-muted-foreground">
                {parentFolder(file.filePath)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSession({
                  queue: files.map((entry) => entry.id),
                  currentId: file.id,
                  done: [],
                })
              }
            >
              <Wand2 aria-hidden />
              Fix match
            </Button>
          </li>
        ))}
      </ul>
      <FixMatchDialog
        session={session}
        onSessionChange={setSession}
        files={files}
        onFixed={onFixed}
      />
    </section>
  );
}
