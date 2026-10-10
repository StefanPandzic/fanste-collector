import { MonitorDown } from 'lucide-react';

import { DesktopOnly } from '@/components/desktop-only';
import { EmptyState } from '@/components/states/empty-state';
import { requireUser } from '@/features/auth/session';
import { ScannerPageClient } from '@/features/scanner/scanner-page-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Scanner' };

export default async function ScannerPage() {
  await requireUser();
  return (
    <DesktopOnly
      fallback={
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Scanner</h1>
          </header>
          <EmptyState
            icon={MonitorDown}
            title="Only in the desktop app"
            description="The scanner reads the media folders on your computer, so it is only available in the Fanste Collector desktop app."
          />
        </div>
      }
    >
      <ScannerPageClient />
    </DesktopOnly>
  );
}
