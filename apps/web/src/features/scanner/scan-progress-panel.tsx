'use client';

import { LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import type { ScanPhase } from './use-scanner';

interface ScanProgressPanelProps {
  phase: Exclude<ScanPhase, { kind: 'idle' }>;
  onCancel: () => void;
}

/** Live progress of the running scan, with a cancel button (FC-21). */
export function ScanProgressPanel({ phase, onCancel }: ScanProgressPanelProps) {
  const scanning = phase.kind === 'scanning';
  const filesFound = scanning ? (phase.progress?.filesFound ?? 0) : phase.filesFound;

  return (
    <Card className="flex-row items-center gap-4 p-card" role="status" aria-live="polite">
      <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {scanning ? 'Scanning…' : 'Saving the results…'}{' '}
          <span className="text-muted-foreground tabular-nums">
            {filesFound.toLocaleString()} {filesFound === 1 ? 'video' : 'videos'} found
            {scanning && phase.progress
              ? ` · ${phase.progress.directoriesScanned.toLocaleString()} folders read`
              : ''}
          </span>
        </p>
        {scanning && phase.progress && (
          <p
            className="truncate text-caption text-muted-foreground"
            title={phase.progress.currentDirectory}
          >
            {phase.progress.currentDirectory}
          </p>
        )}
      </div>
      {scanning && (
        <Button variant="outline" disabled={phase.cancelling} onClick={onCancel}>
          {phase.cancelling ? 'Stopping…' : 'Cancel'}
        </Button>
      )}
    </Card>
  );
}
