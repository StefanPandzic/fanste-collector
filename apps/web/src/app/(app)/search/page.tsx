import { requireUser } from '@/features/auth/session';
import { getProfile } from '@/features/profile/queries';
import { SearchPageClient } from '@/features/search/search-page-client';
import { parseSearchState } from '@/features/search/search-state';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const user = await requireUser();
  const [profile, params] = await Promise.all([getProfile(user.id), searchParams]);

  return (
    <SearchPageClient
      initialState={parseSearchState(params)}
      currency={profile?.default_currency ?? 'EUR'}
    />
  );
}
