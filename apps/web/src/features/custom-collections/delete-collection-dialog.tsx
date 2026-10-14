'use client';

import { useCollectionStats, useCustomCollectionMutations } from '@fanste/collection';

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

import { deleteCollectionText } from './collection-view';

import type { CustomCollection } from '@fanste/core';

interface DeleteCollectionDialogProps {
  /** The collection to delete; the dialog is open while it's set. */
  collection: CustomCollection | null;
  onClose: () => void;
  /** The delete was sent (it shows at once). */
  onDeleted?: () => void;
}

/** Confirms deleting a custom collection, naming how many items go with it (FC-13). */
export function DeleteCollectionDialog({
  collection,
  onClose,
  onDeleted,
}: DeleteCollectionDialogProps) {
  const stats = useCollectionStats();
  const { remove } = useCustomCollectionMutations();
  const count = collection ? stats.data?.byCustomCollection[collection.id]?.items : undefined;

  return (
    <AlertDialog open={collection !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{collection?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {/* Without the stats the count is unknown: never claim there is nothing to lose. */}
            {deleteCollectionText(stats.isSuccess ? (count ?? 0) : undefined)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (!collection) return;
              remove.mutate(collection.id);
              onDeleted?.();
              onClose();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
