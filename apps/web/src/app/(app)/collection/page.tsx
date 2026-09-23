import { PagePlaceholder } from '@/components/page-placeholder';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Collection' };

export default function CollectionPage() {
  return (
    <PagePlaceholder
      title="Collection"
      description="Everything you own, in one gallery."
      task="FC-18"
    />
  );
}
