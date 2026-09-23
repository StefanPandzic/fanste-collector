import { PagePlaceholder } from '@/components/page-placeholder';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Export' };

export default function ExportPage() {
  return (
    <PagePlaceholder
      title="Export"
      description="Download your collection as CSV or a PDF catalog."
      task="FC-25 and FC-26"
    />
  );
}
