import { requireUser } from '@/features/auth/session';
import { ExportPageClient } from '@/features/export/export-page-client';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Export' };

export default async function ExportPage() {
  await requireUser();
  return <ExportPageClient />;
}
