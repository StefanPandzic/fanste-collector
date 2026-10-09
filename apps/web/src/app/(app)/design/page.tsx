import { notFound } from 'next/navigation';

import { serverEnv } from '@/env/server';
import { DesignShowcase } from '@/features/design-system/showcase';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Design system' };

/** Component showcase (FC-16). Development only, and not in the nav. */
export default function DesignPage() {
  if (serverEnv.NODE_ENV === 'production') notFound();
  return <DesignShowcase />;
}
