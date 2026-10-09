'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  collectionErrorMessage,
  copyDefaultsQuery,
  refKey,
  useAddItem,
  useCollectionContext,
} from '@fanste/collection';
import { quickAddInput } from '@fanste/core';

import { providerItemQuery } from './item-query';

import type { AddTarget } from './add-item-form';

/**
 * One-click add: loads the full item, fills in the suggested medium and details, and adds it as
 * owned. The card shows the copy at once (optimistic); failed adds are reported by the collection
 * provider's toast. `isPending(target)` is true while that item's add is running.
 */
export function useQuickAdd({ onAdded }: { onAdded?: (title: string) => void } = {}) {
  const { api, client, userId } = useCollectionContext();
  const queryClient = useQueryClient();
  const addItem = useAddItem();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  function setItemPending(key: string, value: boolean) {
    setPending((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function quickAdd(target: AddTarget): Promise<void> {
    const key = refKey(target);
    if (pending.has(key)) return;
    setItemPending(key, true);
    try {
      let item;
      try {
        item = await queryClient.fetchQuery(providerItemQuery(api, target));
      } catch (error) {
        toast.error(collectionErrorMessage(error));
        return;
      }
      // Wait for the last-used values (cached after the first load); add without them if they fail.
      const defaults = await queryClient
        .fetchQuery(copyDefaultsQuery(client, userId))
        .catch(() => undefined);
      const input = quickAddInput(target, item, defaults?.[target.category]);
      try {
        await addItem.mutateAsync({ input, metadata: item });
        onAdded?.(item.title);
      } catch {
        // The collection provider already showed the error.
      }
    } finally {
      setItemPending(key, false);
    }
  }

  return { quickAdd, isPending: (target: AddTarget) => pending.has(refKey(target)) };
}
