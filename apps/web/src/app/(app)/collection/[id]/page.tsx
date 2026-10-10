import { requireUser } from '@/features/auth/session';
import { ItemDetailPageClient } from '@/features/item-detail/item-detail-page-client';
import { getProfile } from '@/features/profile/queries';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Item' };

export default async function CollectionItemPage({ params }: PageProps<'/collection/[id]'>) {
  const user = await requireUser();
  const [profile, { id }] = await Promise.all([getProfile(user.id), params]);
  return <ItemDetailPageClient id={id} currency={profile?.default_currency ?? 'EUR'} />;
}
