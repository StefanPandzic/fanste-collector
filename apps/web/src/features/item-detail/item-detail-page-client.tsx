'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import {
  collectionErrorMessage,
  isOptimisticId,
  useCollectionContext,
  useCollectionItem,
} from '@fanste/collection';

import { CoverImage } from '@/components/items/cover-image';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AddTarget } from '@/features/search/add-item-form';
import { providerItemQuery } from '@/features/search/item-query';

import { CopySection } from './copy-section';
import { CopySwitcher } from './copy-switcher';
import { EditedMarker } from './edited-marker';
import { ItemActions } from './item-actions';
import { originalValueText, toItemDetailView } from './item-detail-view';
import { ItemHeader } from './item-header';
import { MetadataEditor } from './metadata-editor';

import type { CollectionItem } from '@fanste/core';

interface ItemDetailPageClientProps {
  id: string;
  /** The user's default currency, set with a copy's first price or value. */
  currency: string;
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="w-fit">
      <Link href="/collection">
        <ArrowLeft aria-hidden />
        Collection
      </Link>
    </Button>
  );
}

/**
 * The item page (FC-19): provider metadata with the user's overrides, and the user's copy, both
 * editable. It shows the cached row at once (from the gallery's cache, then the database) and loads
 * the full provider item through the gateway in the background.
 */
export function ItemDetailPageClient({ id, currency }: ItemDetailPageClientProps) {
  const item = useCollectionItem(isOptimisticId(id) ? undefined : id);
  // Set when the item is deleted here, while the page navigates back to the gallery.
  const [leaving, setLeaving] = useState(false);

  let content;
  if (leaving) {
    content = null;
  } else if (isOptimisticId(id)) {
    content = (
      <EmptyState
        title="This item is still being added"
        description="Open it again from your collection in a moment."
      />
    );
  } else if (item.data) {
    content = (
      <ItemDetail item={item.data} currency={currency} onDeleted={() => setLeaving(true)} />
    );
  } else if (item.isError) {
    content = (
      <ErrorState
        title="This item couldn't be loaded"
        description={collectionErrorMessage(item.error)}
        onRetry={() => void item.refetch()}
      />
    );
  } else if (item.data === null) {
    content = (
      <EmptyState
        icon={SearchX}
        title="Item not found"
        description="It may have been deleted, on this device or another one."
        action={
          <Button asChild variant="outline">
            <Link href="/collection">Back to the collection</Link>
          </Button>
        }
      />
    );
  } else {
    content = (
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]" aria-busy="true" aria-label="Loading">
        <Skeleton className="aspect-cover w-48 md:w-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <BackLink />
        {content}
      </div>
    </TooltipProvider>
  );
}

interface ItemDetailProps {
  item: CollectionItem;
  currency: string;
  onDeleted: () => void;
}

function ItemDetail({ item, currency, onDeleted }: ItemDetailProps) {
  const { api } = useCollectionContext();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const target: AddTarget | undefined =
    item.provider !== 'custom' && item.externalId !== null
      ? { category: item.category, provider: item.provider, externalId: item.externalId }
      : undefined;
  // The full provider item, in the background: it fills in while the row has no cached metadata,
  // and asking the gateway refreshes a stale cache row.
  const providerQuery = providerItemQuery(api, target);
  const providerItem = useQuery(providerQuery);

  const view = toItemDetailView(item, providerItem.data);
  const itemRef = target && { provider: target.provider, externalId: target.externalId };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <div className="flex w-48 flex-col gap-2 md:w-full">
          <CoverImage
            src={view.display?.imageUrl ?? item.metadataOverrides.imageUrl}
            alt={view.title}
            category={item.category}
            sizes="(min-width: 768px) 16rem, 12rem"
            priority
            unoptimized={view.coverUnoptimized}
            className="shadow-card"
          />
          {view.overridden.has('imageUrl') && !editing && (
            <EditedMarker hint={originalValueText('imageUrl', view.original, item.provider)} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {editing ? (
            <MetadataEditor
              key={item.id}
              item={item}
              view={view}
              onDone={() => setEditing(false)}
            />
          ) : (
            <ItemHeader item={item} view={view} />
          )}
          <ItemActions
            item={item}
            itemRef={itemRef}
            title={view.title}
            sourceUrl={view.original?.sourceUrl}
            editing={editing}
            onEdit={() => setEditing(true)}
            onDeleted={onDeleted}
            onRefreshed={(fresh) => {
              queryClient.setQueryData(providerQuery.queryKey, fresh);
            }}
          />
        </div>
      </div>

      {itemRef && (
        <CopySwitcher
          itemId={item.id}
          itemRef={itemRef}
          category={item.category}
          title={view.original?.title ?? view.title}
        />
      )}
      <Separator />
      {/* A new form per copy, so its unsaved edits never carry over to another copy. */}
      <CopySection key={item.id} item={item} metadata={view.original} defaultCurrency={currency} />
    </>
  );
}
