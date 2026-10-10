import { requireUser } from '@/features/auth/session';
import { DashboardPageClient } from '@/features/dashboard/dashboard-page-client';
import { getProfile } from '@/features/profile/queries';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  return <DashboardPageClient currency={profile?.default_currency ?? 'EUR'} />;
}
