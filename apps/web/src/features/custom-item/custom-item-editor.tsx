'use client';

import {
  removeCustomImage,
  useCollectionContext,
  useUpdateCustomItemData,
} from '@fanste/collection';

import { Button } from '@/components/ui/button';
import { useAutosave } from '@/features/item-detail/use-autosave';

import { CustomItemFields } from './custom-item-fields';
import { customItemFieldValues, toCustomItemDataPatch } from './custom-item-form';

import type { CustomItemFieldValues } from './custom-item-form';
import type { CollectionItem } from '@fanste/core';

interface CustomItemEditorProps {
  item: CollectionItem;
  onDone: () => void;
}

/**
 * "Edit item" of a hand-entered item (FC-13): its own fields, each saved on its own like the
 * overrides of a provider item (FC-19). An upload or removal of the photo saves at once, and the
 * upload it replaces is deleted.
 */
export function CustomItemEditor({ item, onDone }: CustomItemEditorProps) {
  const { client, userId } = useCollectionContext();
  const update = useUpdateCustomItemData();
  const form = useAutosave<CustomItemFieldValues>(
    customItemFieldValues(item.customData),
    (changes, onSettled) => {
      const { patch, errors } = toCustomItemDataPatch(changes);
      if (Object.keys(patch).length > 0) {
        const replaced = patch.imageUrl !== undefined ? item.customData?.imageUrl : undefined;
        update.mutateAsync({ id: item.id, patch }).then(() => {
          onSettled();
          // A replaced or removed upload is no longer used: free its storage (best effort).
          if (replaced && replaced !== patch.imageUrl)
            void removeCustomImage(client, userId, replaced);
        }, onSettled);
      } else {
        onSettled();
      }
      return errors;
    },
    // Errors are keyed `item.<field>`, like the fields show them.
    (key) => key.replace(/^item\./, ''),
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="item-edit-custom">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="item-edit-custom" className="text-heading">
          Edit item
        </h2>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            form.flush();
            onDone();
          }}
        >
          Done
        </Button>
      </div>
      <CustomItemFields
        idPrefix="item"
        category={item.category}
        values={form.values}
        onChange={(field, value, options) => form.set(field, value, options)}
        onBlur={form.flush}
        errors={form.errors}
      />
    </section>
  );
}
