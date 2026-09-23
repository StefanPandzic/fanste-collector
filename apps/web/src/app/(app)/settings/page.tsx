import { PagePlaceholder } from '@/components/page-placeholder';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <PagePlaceholder title="Settings" description="Profile and app preferences." task="FC-06" />
  );
}
