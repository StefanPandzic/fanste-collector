'use client';

import { ExternalLink, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { useDeleteItem, useRefreshMetadata, useRestoreItem } from '@fanste/collection';
import { providerLabel } from '@fanste/core';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import type { CollectionItem, ItemRef, NormalizedItem } from '@fanste/core';

interface ItemActionsProps {
  item: CollectionItem;
  /** The provider item, `undefined` for a custom item. */
  itemRef: ItemRef | undefined;
  title: string;
  /** The provider's page (attribution). */
  sourceUrl: string | undefined;
  editing: boolean;
  onEdit: () => void;
  /** Called with the fresh provider item after a refresh. */
  onRefreshed: (item: NormalizedItem) => void;
  /** Called when the item is deleted, before the page navigates away. */
  onDeleted: () => void;
}

/** Edit metadata, refresh it from the provider, open the provider's page, delete with undo. */
export function ItemActions({
  item,
  itemRef,
  title,
  sourceUrl,
  editing,
  onEdit,
  onRefreshed,
  onDeleted,
}: ItemActionsProps) {
  const router = useRouter();
  const refresh = useRefreshMetadata();
  const deleteItem = useDeleteItem();
  const restoreItem = useRestoreItem();
  const [confirming, setConfirming] = useState(false);
  const provider = providerLabel(item.provider);

  function refreshMetadata() {
    if (!itemRef) return;
    // Failures are reported by the collection provider's error toast.
    refresh.mutateAsync(itemRef).then(
      (fresh) => {
        onRefreshed(fresh);
        toast.success(`Metadata refreshed from ${provider}.`);
      },
      () => undefined,
    );
  }

  function remove() {
    // The copy as it was, for the undo. The page unmounts, so the callbacks are on the promises:
    // `mutate`'s own callbacks don't run after that.
    const snapshot = item;
    // The delete empties the item's cache entry; without this the page would flash "not found".
    onDeleted();
    deleteItem.mutateAsync(item.id).then(
      () =>
        toast(`Deleted “${title}”`, {
          action: {
            label: 'Undo',
            onClick: () => {
              restoreItem.mutateAsync(snapshot).then(
                () => toast.success(`Restored “${title}”`),
                () => undefined,
              );
            },
          },
        }),
      () => undefined,
    );
    router.push('/collection');
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!editing && (
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil aria-hidden />
          Edit metadata
        </Button>
      )}
      {itemRef && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshMetadata}
          disabled={refresh.isPending}
        >
          <RefreshCw aria-hidden className={refresh.isPending ? 'animate-spin' : undefined} />
          Refresh metadata
        </Button>
      )}
      {sourceUrl && (
        <Button asChild variant="ghost" size="sm">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            View on {provider}
          </a>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden />
        Delete
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This copy{item.format ? ` (${item.format})` : ''} is removed from your collection on
              all your devices, with its details, notes and tags. You can undo it for a few seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
