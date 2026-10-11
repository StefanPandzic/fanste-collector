'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { collectionErrorMessage, useScanMatcher, useScannedFiles } from '@fanste/collection';

import { deviceIdQuery, scannerBridge } from './scanner-bridge';
import { matchSummary } from './scanner-view';

import type { ScanMatcher, ScanMatchSummary } from '@fanste/collection';
import type { ReactNode } from 'react';

const ScanMatcherContext = createContext<ScanMatcher | null>(null);

/**
 * The background matcher (FC-23) of the desktop app: `null` in a browser or a desktop build without
 * the scanner.
 */
export function useScanMatcherContext(): ScanMatcher | null {
  return use(ScanMatcherContext);
}

/**
 * Runs the scanner's background matching on every page of the desktop app (in the `(app)` layout):
 * once the device's scanned files are loaded, files still `pending` (a run that was stopped, or a
 * restart) are matched; the scanner page starts a run after each scan. Ends each run with a summary
 * toast. Renders only its children in a browser.
 */
export function ScanMatcherProvider({ children }: { children: ReactNode }) {
  // Read once on mount: the bridge doesn't come or go while the page is open.
  const [scanner] = useState(scannerBridge);
  const deviceId = useQuery(deviceIdQuery(scanner));
  const files = useScannedFiles(deviceId.data);

  const onFinished = useCallback(({ added, review, remaining, error }: ScanMatchSummary) => {
    if (error !== undefined) {
      toast.error(`Matching stopped. ${collectionErrorMessage(error)} It continues later.`);
    } else if (added > 0 || review > 0) {
      toast.success(matchSummary({ added, review, remaining }));
    }
  }, []);
  const matcher = useScanMatcher(deviceId.data, onFinished);

  // Picks up where the last run stopped, once per device.
  const startedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!files.data || !deviceId.data || startedFor.current === deviceId.data) return;
    startedFor.current = deviceId.data;
    matcher.start();
  }, [deviceId.data, files.data, matcher]);

  return (
    <ScanMatcherContext value={scanner && deviceId.data ? matcher : null}>
      {children}
    </ScanMatcherContext>
  );
}
