'use client';

import { cn } from 'cn';
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { isOptimisticId, refKey, useCollectionCopies } from '@fanste/collection';
import { ownershipLabel } from '@fanste/core';

import { Button } from '@/components/ui/button';
import { searchStateUrl } from '@/features/search/search-state';

import type { ItemCategory, ItemRef } from '@fanste/core';
import type { Route } from 'next';

interface CopySwitcherProps {
  /** The copy shown on the page. */
  itemId: string;
  itemRef: ItemRef;
  category: ItemCategory;
  /** For "Add another copy", which searches the title. */
  title: string;
}

/**
 * The user's copies of this title (e.g. DVD and 4K UHD Blu-ray), one link each: every copy has its
 * own page and details (FC-15).
 */
export function CopySwitcher({ itemId, itemRef, category, title }: CopySwitcherProps) {
  const copies = useCollectionCopies([itemRef]);
  const list = (copies.data?.[refKey(itemRef)] ?? []).filter((copy) => !isOptimisticId(copy.id));

  return (
    <nav aria-label="Your copies" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {list.length > 1 ? `${list.length} copies:` : 'Your copy:'}
      </span>
      {list.map((copy) => {
        const current = copy.id === itemId;
        return (
          <Button
            key={copy.id}
            asChild
            variant={current ? 'secondary' : 'outline'}
            size="sm"
            className={cn(current && 'pointer-events-none')}
          >
            <Link
              href={`/collection/${copy.id}` as Route}
              aria-current={current ? 'page' : undefined}
              title={ownershipLabel(copy.ownership)}
            >
              {copy.format ?? 'No medium'}
            </Link>
          </Button>
        );
      })}
      <Button asChild variant="ghost" size="sm">
        <Link href={searchStateUrl({ category, q: title }) as Route}>
          <Plus aria-hidden />
          Add another copy
        </Link>
      </Button>
    </nav>
  );
}
