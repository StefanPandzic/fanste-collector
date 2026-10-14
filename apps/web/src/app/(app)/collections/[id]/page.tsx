import { requireUser } from '@/features/auth/session';
import { parseGalleryState } from '@/features/collection/gallery-state';
import { CustomCollectionPageClient } from '@/features/custom-collections/custom-collection-page-client';
import { getProfile } from '@/features/profile/queries';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Collection' };

/** A custom collection (FC-13): its items in the gallery, with "Add item". */
export default async function CustomCollectionPage({
  params,
  searchParams,
}: PageProps<'/collections/[id]'>) {
  const user = await requireUser();
  const [profile, { id }, query] = await Promise.all([getProfile(user.id), params, searchParams]);
  const { filter, sort } = parseGalleryState(query);
  // The page is the collection: a category or collection filter in the URL doesn't apply.
  delete filter.category;
  delete filter.customCollectionIds;
  return (
    <CustomCollectionPageClient
      id={id}
      initialState={{ filter, sort }}
      currency={profile?.default_currency ?? 'EUR'}
    />
  );
}
