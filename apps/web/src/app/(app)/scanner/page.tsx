import { DesktopOnly } from '@/components/desktop-only';
import { PagePlaceholder } from '@/components/page-placeholder';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Scanner' };

export default function ScannerPage() {
  return (
    <DesktopOnly
      fallback={
        <PagePlaceholder
          title="Scanner"
          description="The scanner reads your local media folders, so it is only available in the desktop app."
          task="FC-21 – FC-24"
        />
      }
    >
      <PagePlaceholder
        title="Scanner"
        description="Scan local folders for movies and TV shows and add them to your collection."
        task="FC-21 – FC-24"
      />
    </DesktopOnly>
  );
}
