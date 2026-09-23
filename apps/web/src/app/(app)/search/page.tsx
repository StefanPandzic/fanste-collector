import { PagePlaceholder } from '@/components/page-placeholder';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

export default function SearchPage() {
  return (
    <PagePlaceholder
      title="Search"
      description="Find movies, TV, music, games and more to add to your collection."
      task="FC-17"
    />
  );
}
