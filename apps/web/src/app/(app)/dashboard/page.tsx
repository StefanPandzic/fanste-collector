import { PagePlaceholder } from '@/components/page-placeholder';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <PagePlaceholder title="Dashboard" description="An overview of your collection." task="FC-20" />
  );
}
