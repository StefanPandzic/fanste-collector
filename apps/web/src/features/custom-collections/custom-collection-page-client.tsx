'use client';

import { ArrowLeft, MoreHorizontal, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { collectionErrorMessage, useCustomCollections } from '@fanste/collection';

import { COLLECTION_ICONS, CollectionIcon } from '@/components/items/collection-icon';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { CollectionPageClient } from '@/features/collection/collection-page-client';
import type { GalleryState } from '@/features/collection/gallery-state';
import { CustomItemDialog } from '@/features/custom-item/custom-item-dialog';

import { CollectionDialog } from './collection-dialog';
import { collectionHref } from './collection-view';
import { DeleteCollectionDialog } from './delete-collection-dialog';

import type { CustomCollection } from '@fanste/core';

interface CustomCollectionPageClientProps {
  id: string;
  /** The user's filters and sort, from the URL. */
  initialState: GalleryState;
  /** The user's default currency, for prices of new items. */
  currency: string;
}

/**
 * A custom collection's page (FC-13): its name, icon and description, Edit / Delete, "Add item",
 * and the gallery of its items with the usual filters.
 */
export function CustomCollectionPageClient({
  id,
  initialState,
  currency,
}: CustomCollectionPageClientProps) {
  const collections = useCustomCollections();
  const collection = collections.data?.find((entry) => entry.id === id);

  if (collection) {
    return (
      // A new gallery per collection, so filters and paging don't carry over.
      <CollectionView
        key={collection.id}
        collection={collection}
        initialState={initialState}
        currency={currency}
      />
    );
  }
  if (collections.isError) {
    return (
      <ErrorState
        title="This collection couldn't be loaded"
        description={collectionErrorMessage(collections.error)}
        onRetry={() => void collections.refetch()}
      />
    );
  }
  if (collections.isSuccess) {
    return (
      <EmptyState
        icon={SearchX}
        title="Collection not found"
        description="It may have been deleted, on this device or another one."
        action={
          <Button asChild variant="outline">
            <Link href="/collection">Back to the collection</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-60" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}

interface CollectionViewProps {
  collection: CustomCollection;
  initialState: GalleryState;
  currency: string;
}

function CollectionView({ collection, initialState, currency }: CollectionViewProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus aria-hidden />
      Add item
    </Button>
  );

  const header = (
    <header className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/collection">
          <ArrowLeft aria-hidden />
          Collection
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-category-custom/10 text-category-custom">
            <CollectionIcon icon={collection.icon} className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{collection.name}</h1>
            {collection.description && (
              <p className="max-w-prose whitespace-pre-line text-muted-foreground">
                {collection.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {addButton}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Collection actions">
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit collection
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 aria-hidden />
                Delete collection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );

  return (
    <>
      <CollectionPageClient
        initialState={initialState}
        scope={{
          filter: { category: 'custom', customCollectionIds: [collection.id] },
          path: collectionHref(collection.id),
          header,
          empty: (
            <EmptyState
              icon={COLLECTION_ICONS[collection.icon]}
              title={`Nothing in “${collection.name}” yet`}
              description="Add your first item: a title is all it needs."
              action={addButton}
            />
          ),
        }}
      />
      <CustomItemDialog
        target={adding ? { category: 'custom', customCollectionId: collection.id } : null}
        title={`Add to ${collection.name}`}
        currency={currency}
        onClose={() => setAdding(false)}
      />
      <CollectionDialog open={editing} collection={collection} onClose={() => setEditing(false)} />
      <DeleteCollectionDialog
        collection={deleting ? collection : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => router.push('/collection')}
      />
    </>
  );
}
