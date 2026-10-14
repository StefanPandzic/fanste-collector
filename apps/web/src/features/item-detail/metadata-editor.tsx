'use client';

import { RotateCcw } from 'lucide-react';

import {
  removeCustomImage,
  useCollectionContext,
  useResetOverrides,
  useUpdateOverrides,
} from '@fanste/collection';
import { MAX_OVERRIDE_DESCRIPTION_LENGTH, MAX_OVERRIDE_TITLE_LENGTH } from '@fanste/core';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/copy-form/form-field';
import { ImageField } from '@/features/custom-item/image-field';

import { EditedMarker } from './edited-marker';
import { originalValueText, overrideFieldValues, toOverridesPatch } from './item-detail-view';
import { useAutosave } from './use-autosave';

import type { ItemDetailView, OverrideFieldValues } from './item-detail-view';
import type { CollectionItem, OverridableField } from '@fanste/core';

const FIELDS: readonly {
  field: OverridableField;
  label: string;
  hint?: string;
  multiline?: boolean;
}[] = [
  { field: 'title', label: 'Title' },
  { field: 'subtitle', label: 'Subtitle' },
  { field: 'releaseYear', label: 'Year' },
  {
    field: 'imageUrl',
    label: 'Cover image',
    hint: 'Upload an image, or paste an https:// address.',
  },
  { field: 'genres', label: 'Genres', hint: 'Separate them with commas.' },
  { field: 'creators', label: 'Creators', hint: 'Separate the names with commas.' },
  { field: 'description', label: 'Description', multiline: true },
];

interface MetadataEditorProps {
  item: CollectionItem;
  view: ItemDetailView;
  onDone: () => void;
}

/**
 * "Edit metadata" (FC-19): the user's overrides of the provider's fields. A field saves on its own;
 * emptying it, or typing the provider's value, goes back to the original.
 */
export function MetadataEditor({ item, view, onDone }: MetadataEditorProps) {
  const { client, userId } = useCollectionContext();
  const updateOverrides = useUpdateOverrides();
  const resetOverrides = useResetOverrides();
  const form = useAutosave<OverrideFieldValues>(
    overrideFieldValues(view.display),
    (changes, onSettled) => {
      const { patch, errors } = toOverridesPatch(changes, view.original);
      if (Object.keys(patch).length > 0) {
        const replaced = patch.imageUrl !== undefined ? item.metadataOverrides.imageUrl : undefined;
        updateOverrides.mutateAsync({ id: item.id, patch }).then(() => {
          onSettled();
          if (replaced !== patch.imageUrl) freeCover(replaced);
        }, onSettled);
      } else {
        onSettled();
      }
      return errors;
    },
  );

  /** Deletes an uploaded cover the item no longer uses (best effort; pasted URLs are skipped). */
  function freeCover(url: string | undefined) {
    if (url) void removeCustomImage(client, userId, url);
  }

  /** Resets one field or all of them; a custom cover that was an upload is deleted afterwards. */
  function reset(field?: OverridableField) {
    const cover =
      field === undefined || field === 'imageUrl' ? item.metadataOverrides.imageUrl : undefined;
    resetOverrides.mutateAsync({ id: item.id, field }).then(
      () => freeCover(cover),
      () => undefined,
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="item-edit-metadata">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="item-edit-metadata" className="text-heading">
          Edit metadata
        </h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={view.overridden.size === 0}
            onClick={() => reset()}
          >
            <RotateCcw aria-hidden />
            Reset all
          </Button>
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
      </div>
      <p className="text-sm text-muted-foreground">
        Your changes show only in your collection. Refreshing the metadata never overwrites them.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ field, label, hint, multiline }) => {
          const id = `item-override-${field}`;
          const edited = view.overridden.has(field);
          const control = {
            id,
            value: form.values[field],
            onChange: (event: { target: { value: string } }) => form.set(field, event.target.value),
            onBlur: form.flush,
            'aria-invalid': form.errors[field] ? true : undefined,
          };
          return (
            <div key={field} className={multiline ? 'sm:col-span-2' : undefined}>
              <FormField id={id} label={label} hint={hint} error={form.errors[field]}>
                {multiline ? (
                  <Textarea rows={6} maxLength={MAX_OVERRIDE_DESCRIPTION_LENGTH} {...control} />
                ) : field === 'imageUrl' ? (
                  <ImageField
                    id={id}
                    value={form.values.imageUrl}
                    onChange={(value, options) => form.set('imageUrl', value, options)}
                    onBlur={form.flush}
                    invalid={form.errors.imageUrl !== undefined}
                  />
                ) : (
                  <Input
                    maxLength={MAX_OVERRIDE_TITLE_LENGTH}
                    inputMode={field === 'releaseYear' ? 'numeric' : undefined}
                    {...control}
                  />
                )}
              </FormField>
              {edited && (
                <div className="mt-1">
                  <EditedMarker
                    field={label.toLowerCase()}
                    hint={originalValueText(field, view.original, item.provider)}
                    onReset={() => reset(field)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
