import Link from 'next/link';

import { PagePlaceholder } from '@/components/page-placeholder';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/features/auth/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Item' };

/** Stub: the gallery's cards link here; the item detail and edit page is FC-19. */
export default async function CollectionItemPage() {
  await requireUser();
  return (
    <PagePlaceholder
      title="Item details"
      description="Everything about this copy, and editing it."
      task="FC-19"
    >
      <Button asChild variant="outline">
        <Link href="/collection">Back to the collection</Link>
      </Button>
    </PagePlaceholder>
  );
}
