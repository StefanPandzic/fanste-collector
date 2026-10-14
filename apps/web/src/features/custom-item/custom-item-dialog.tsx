'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { useAddCustomItem } from '@fanste/collection';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopyDetailsFields } from '@/features/copy-form/copy-details-fields';
import { CopyFieldsSection } from '@/features/copy-form/copy-fields-section';
import { copyDetailsSummary, showsCopyDetails } from '@/features/copy-form/copy-form';
import type { CopyFormDetails } from '@/features/copy-form/copy-form';
import { CustomDetailsFields } from '@/features/copy-form/custom-details-fields';
import { MusicDetailsFields } from '@/features/copy-form/music-details-fields';
import { VideoGameDetailsFields } from '@/features/copy-form/video-game-details-fields';

import { CustomItemFields } from './custom-item-fields';
import { initialCustomItemForm, toAddCustomItemInput } from './custom-item-form';

import type { CustomItemFormValues, CustomItemTarget } from './custom-item-form';
import type { CustomItemField } from '@fanste/core';
import type { FormEvent } from 'react';

interface CustomItemDialogProps {
  /** Where the new item goes; the dialog is open while it's set. */
  target: CustomItemTarget | null;
  /** e.g. `Add to Funko Pops` or `Add a movie manually`. */
  title: string;
  description?: string;
  /** The user's default currency, for the price and value. */
  currency: string;
  onClose: () => void;
}

/**
 * The form of a hand-entered item (FC-13): the item's own fields, its copy and the copy details
 * of its category. "Add another" saves and starts over, to enter several items quickly.
 */
export function CustomItemDialog({
  target,
  title,
  description,
  currency,
  onClose,
}: CustomItemDialogProps) {
  // A new form each time the dialog opens, so no values carry over.
  const [session, setSession] = useState(0);
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? 'Enter what you know; only the title is required.'}
          </DialogDescription>
        </DialogHeader>
        {target && (
          <CustomItemForm
            key={session}
            target={target}
            currency={currency}
            onClose={onClose}
            onAddAnother={() => setSession((current) => current + 1)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface CustomItemFormProps {
  target: CustomItemTarget;
  currency: string;
  onClose: () => void;
  /** Saved with "Add another": start a new, empty form. */
  onAddAnother: () => void;
}

function CustomItemForm({ target, currency, onClose, onAddAnother }: CustomItemFormProps) {
  const addItem = useAddCustomItem();
  const custom = target.category === 'custom';
  const [values, setValues] = useState<CustomItemFormValues>(() =>
    initialCustomItemForm(custom ? 'Physical' : ''),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function clearError(key: string) {
    setErrors(({ [key]: _removed, ...rest }) => rest);
  }

  function setItem(field: CustomItemField, value: string) {
    setValues((current) => ({ ...current, item: { ...current.item, [field]: value } }));
    clearError(`item.${field}`);
  }

  function set<K extends keyof CustomItemFormValues>(field: K, value: CustomItemFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    clearError(field);
  }

  function setDetail<K extends keyof CopyFormDetails>(field: K, value: CopyFormDetails[K]) {
    setValues((current) => ({ ...current, details: { ...current.details, [field]: value } }));
    clearError(`details.${field}`);
  }

  function save(event: FormEvent, another: boolean) {
    event.preventDefault();
    const converted = toAddCustomItemInput(values, target, currency);
    if (!converted.ok) {
      setErrors(converted.errors);
      return;
    }
    const added = converted.input.customData.title;
    // Optimistic: the item shows up at once, and the collection provider reports a failure.
    addItem.mutateAsync(converted.input).then(
      () => toast.success(`Added “${added}”`),
      () => undefined,
    );
    if (another) onAddAnother();
    else onClose();
  }

  const copy = showsCopyDetails(values.ownership);
  const detailProps = {
    format: values.format,
    details: values.details,
    onFormatChange: (value: string) => set('format', value),
    markerOf: () => undefined,
    errors,
  };

  return (
    <form
      onSubmit={(event) => save(event, false)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-col gap-6 overflow-y-auto p-4">
        <section className="flex flex-col gap-4" aria-labelledby="custom-item-heading">
          <h3 id="custom-item-heading" className="text-heading">
            The item
          </h3>
          <CustomItemFields
            idPrefix="add"
            category={target.category}
            values={values.item}
            onChange={setItem}
            errors={errors}
            autoFocusTitle
          />
        </section>

        <CopyFieldsSection
          values={values}
          errors={errors}
          currency={currency}
          onChange={(field, value) => set(field, value as CustomItemFormValues[typeof field])}
        />

        {copy ? (
          <section className="flex flex-col gap-4" aria-labelledby="custom-copy-details">
            <h3 id="custom-copy-details" className="text-heading">
              Copy details
            </h3>
            {target.category === 'custom' ? (
              <CustomDetailsFields
                {...detailProps}
                onDetailChange={(field, value) => setDetail(field, value)}
              />
            ) : target.category === 'music' ? (
              <MusicDetailsFields
                {...detailProps}
                onDetailChange={(field, value) => setDetail(field, value)}
              />
            ) : target.category === 'video_game' ? (
              <VideoGameDetailsFields
                {...detailProps}
                gamePlatforms={undefined}
                onDetailChange={(field, value) => setDetail(field, value)}
              />
            ) : (
              <CopyDetailsFields
                {...detailProps}
                category={target.category === 'tv' ? 'tv' : 'movie'}
                onDetailChange={(field, value) => setDetail(field, value)}
              />
            )}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            Copy details ({copyDetailsSummary(target.category)}) are for copies you have. Set them
            when you get it.
          </p>
        )}
      </div>

      <DialogFooter className="m-0 border-t p-4">
        {errors.form && <p className="mr-auto text-sm text-destructive">{errors.form}</p>}
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={(event) => save(event, true)}>
          Add another
        </Button>
        <Button type="submit">Add</Button>
      </DialogFooter>
    </form>
  );
}
