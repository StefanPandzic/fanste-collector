import { requireUser } from '@/features/auth/session';
import { CollectionPageClient } from '@/features/collection/collection-page-client';
import { parseGalleryState } from '@/features/collection/gallery-state';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Collection' };

export default async function CollectionPage({ searchParams }: PageProps<'/collection'>) {
  await requireUser();
  return <CollectionPageClient initialState={parseGalleryState(await searchParams)} />;
}
