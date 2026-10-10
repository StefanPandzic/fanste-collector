'use client';

import { ScanLine, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { DesktopOnly } from '@/components/desktop-only';
import { EmptyState } from '@/components/states/empty-state';
import { Button } from '@/components/ui/button';

/** Shown to new users, whose collection is still empty. */
export function DashboardOnboarding() {
  return (
    <EmptyState
      icon={Sparkles}
      title="Start your collection"
      description="Search for a movie or TV show to add your first item."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/search">
              <Search aria-hidden />
              Search to add your first item
            </Link>
          </Button>
          <DesktopOnly fallback={null}>
            <Button asChild variant="outline">
              <Link href="/scanner">
                <ScanLine aria-hidden />
                Scan a media folder
              </Link>
            </Button>
          </DesktopOnly>
        </div>
      }
    />
  );
}
