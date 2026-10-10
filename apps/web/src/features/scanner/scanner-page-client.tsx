'use client';

import { HardDrive, MonitorDown } from 'lucide-react';
import { useMemo } from 'react';

import { CollectionError, collectionErrorMessage } from '@fanste/collection';

import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Skeleton } from '@/components/ui/skeleton';

import { LibraryFolders } from './library-folders';
import { ScanProgressPanel } from './scan-progress-panel';
import { ScanResultsTable } from './scan-results-table';
import { currentFiles, filesPerFolder } from './scanner-view';
import { useScanner } from './use-scanner';

/**
 * The desktop scanner (FC-21): library folders, scans with live progress, and the scanned files.
 * Rendered only in the desktop app (`<DesktopOnly>` on the page).
 */
export function ScannerPageClient() {
  const scanner = useScanner();
  const { folders, files, phase } = scanner;
  const current = useMemo(() => currentFiles(files.data ?? []), [files.data]);
  const counts = useMemo(
    () => filesPerFolder(current, folders.data ?? []),
    [current, folders.data],
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Scanner</h1>
        <p className="text-muted-foreground">
          Scan folders on this computer for movies and TV shows.
        </p>
      </header>

      {!scanner.supported ? (
        <EmptyState
          icon={MonitorDown}
          title="Update the desktop app"
          description="This version of the desktop app can't scan folders yet. Install the latest version to use the scanner."
        />
      ) : folders.isPending || scanner.deviceId.isPending || files.isPending ? (
        <ScannerSkeleton />
      ) : files.isError || folders.isError || scanner.deviceId.isError ? (
        <ErrorState
          title="The scanner couldn't be loaded"
          description={
            files.error instanceof CollectionError ? collectionErrorMessage(files.error) : undefined
          }
          onRetry={() => {
            void folders.refetch();
            void scanner.deviceId.refetch();
            void files.refetch();
          }}
        />
      ) : (
        <>
          <LibraryFolders
            folders={folders.data}
            fileCounts={counts}
            busy={phase.kind !== 'idle'}
            minSizeMb={scanner.minSizeMb}
            onMinSizeChange={scanner.setMinSizeMb}
            onAdd={() => void scanner.addFolders()}
            onScan={(folder) => void scanner.scan(folder ? [folder.path] : undefined)}
            onRemove={(folder) => void scanner.removeFolder(folder)}
          />
          {phase.kind !== 'idle' && <ScanProgressPanel phase={phase} onCancel={scanner.cancel} />}
          {current.length > 0 ? (
            <ScanResultsTable files={current} />
          ) : (
            folders.data.length > 0 &&
            phase.kind === 'idle' && (
              <EmptyState
                icon={HardDrive}
                title="No videos found yet"
                description="Scan your library folders to list the video files in them."
              />
            )
          )}
        </>
      )}
    </div>
  );
}

function ScannerSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
