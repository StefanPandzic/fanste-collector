'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CategoryIcon } from '@/components/items/category-icon';
import { CollectionIcon } from '@/components/items/collection-icon';
import { Button } from '@/components/ui/button';
import { CollectionDialog } from '@/features/custom-collections/collection-dialog';
import { collectionHref, itemCountText } from '@/features/custom-collections/collection-view';

import type { CustomCollectionRowView } from './dashboard-view';

/**
 * "Custom collections" (FC-13): the items and copies the user has in each of their own collections,
 * each linking to its page, or an invitation to create the first one.
 */
export function CustomCollectionsCard({ rows }: { rows: readonly CustomCollectionRowView[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-card text-card-foreground shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-category-custom/10 text-category-custom">
          <CategoryIcon category="custom" className="size-5" />
        </span>
        <h3 className="flex-1 text-sm font-medium">Custom collections</h3>
        <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          New
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Collect something else, like Funko Pops, LEGO or coins? Create a collection for it.
        </p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <CollectionIcon icon={row.icon} className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {itemCountText(row.items)}
                  {row.copies !== row.items && ` · ${row.copies.toLocaleString()} copies`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CollectionDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => router.push(collectionHref(created.id))}
      />
    </div>
  );
}
