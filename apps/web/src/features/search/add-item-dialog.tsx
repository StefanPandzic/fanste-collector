'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useAddItem, useCollectionContext, useCopyDefaults } from '@fanste/collection';
import {
  MAX_NOTES_LENGTH,
  MAX_QUANTITY,
  OWNERSHIP_STATUSES,
  ownAllSeasons,
  ownershipLabel,
  prefillDetails,
  providerLabel,
} from '@fanste/core';

import { CategoryBadge } from '@/components/items/category-badge';
import { CoverImage } from '@/components/items/cover-image';
import { ErrorState } from '@/components/states/error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { initialFormValues, prefillLabel, showsCopyDetails, toAddItemInput } from './add-item-form';
import { CopyDetailsFields } from './copy-details-fields';
import { FormField } from './form-field';
import { providerItemQuery } from './item-query';
import { searchErrorText } from './search-errors';

import type { AddItemFormValues, AddTarget } from './add-item-form';
import type { ItemCopy } from '@fanste/collection';
import type {
  CopyDefaults,
  NormalizedItem,
  OwnershipStatus,
  SearchResult,
  TvDetails,
} from '@fanste/core';
import type { FormEvent } from 'react';

interface AddItemDialogProps {
  /** The result to add; the dialog is open while it's set. */
  result: SearchResult | null;
  target: AddTarget | null;
  /** The user's copies of the item, to warn about adding the same medium twice. */
  copies: readonly ItemCopy[];
  /** The user's default currency, for the price and value. */
  currency: string;
  onClose: () => void;
  onAdded: (title: string) => void;
}

/**
 * "Add with details": the copy fields and the category's copy details, prefilled from the provider
 * and the user's last-used values, editable before saving.
 */
export function AddItemDialog({
  result,
  target,
  copies,
  currency,
  onClose,
  onAdded,
}: AddItemDialogProps) {
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90svh] flex-col gap-0 p-0 sm:max-w-2xl">
        {result && target && (
          <>
            <DialogHeader className="flex-row items-center gap-3 border-b p-4 pr-12">
              <div className="w-12 shrink-0">
                <CoverImage
                  src={result.thumbnailUrl}
                  alt=""
                  category={result.category}
                  sizes="48px"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <DialogTitle className="truncate">{result.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  {result.releaseYear !== undefined && <span>{result.releaseYear}</span>}
                  <CategoryBadge category={result.category} />
                </DialogDescription>
              </div>
            </DialogHeader>
            <DialogBody
              // A new form per item, so its state starts from that item's prefill.
              key={`${target.provider}:${target.externalId}`}
              target={target}
              copies={copies}
              currency={currency}
              onClose={onClose}
              onAdded={onAdded}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type DialogBodyProps = Omit<AddItemDialogProps, 'result' | 'target'> & { target: AddTarget };

/** Loads the full item and the user's last-used values, then shows the form. */
function DialogBody({ target, ...props }: DialogBodyProps) {
  const { api } = useCollectionContext();
  const item = useQuery(providerItemQuery(api, target));
  const defaults = useCopyDefaults();

  if (item.isError) {
    const text = searchErrorText(item.error, providerLabel(target.provider));
    return (
      <div className="p-4">
        <ErrorState
          title="Could not load the details"
          description={text.description}
          onRetry={() => void item.refetch()}
        />
      </div>
    );
  }
  // The last-used values are optional: if they fail to load, the form opens without them.
  if (!item.data || defaults.isPending) {
    return (
      <div className="grid gap-4 p-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    );
  }
  return (
    <AddItemForm
      {...props}
      target={target}
      item={item.data}
      defaults={defaults.data?.[target.category]}
    />
  );
}

interface AddItemFormProps extends DialogBodyProps {
  item: NormalizedItem;
  defaults: CopyDefaults | undefined;
}

function AddItemForm({
  target,
  item,
  defaults,
  copies,
  currency,
  onClose,
  onAdded,
}: AddItemFormProps) {
  const addItem = useAddItem();
  // A TV copy starts with every season owned, like a quick add.
  const [prefill] = useState(() =>
    ownAllSeasons(target.category, prefillDetails(target.category, item, { defaults })),
  );
  const [values, setValues] = useState<AddItemFormValues>(() => initialFormValues(prefill));
  /** Fields the user changed: their prefill marker is gone. */
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function markChanged(field: string) {
    setChanged((current) => (current.has(field) ? current : new Set(current).add(field)));
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  function set<K extends keyof AddItemFormValues>(field: K, value: AddItemFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    markChanged(field);
  }

  function setDetail<K extends keyof TvDetails>(field: K, value: TvDetails[K]) {
    setValues((current) => ({ ...current, details: { ...current.details, [field]: value } }));
    markChanged(field);
    setErrors(({ [`details.${field}`]: _removed, ...rest }) => rest);
  }

  function markerOf(field: string): string | undefined {
    const source = prefill.sources[field];
    return source && !changed.has(field) ? prefillLabel(source, target.provider) : undefined;
  }

  const copy = showsCopyDetails(values.ownership);
  const category = target.category === 'tv' ? 'tv' : 'movie';

  function submit(event: FormEvent) {
    event.preventDefault();
    const converted = toAddItemInput(values, target, currency);
    if (!converted.ok) {
      setErrors(converted.errors);
      return;
    }
    // Same item in the same medium: the database would reject it as a duplicate.
    const medium = (converted.input.format ?? '').trim().toLowerCase();
    if (copies.some((entry) => (entry.format ?? '').trim().toLowerCase() === medium)) {
      setErrors(
        copy
          ? {
              format: medium
                ? 'You already have a copy in this medium. Pick another one.'
                : 'You already have a copy without a medium. Pick one for this copy.',
            }
          : { form: 'You already have this item without a medium.' },
      );
      return;
    }
    // Optimistic: the item shows up at once, and the collection provider reports a failure. The
    // dialog closes (unmounting this form) before the add settles, and `mutate`'s own callbacks don't
    // run after that, so the promise reports success.
    addItem.mutateAsync({ input: converted.input, metadata: item }).then(
      () => onAdded(item.title),
      () => undefined,
    );
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-6 overflow-y-auto p-4">
        {copies.length > 0 && (
          <p className="rounded-lg bg-info/10 px-3 py-2 text-sm text-info" role="note">
            You already have {copies.length === 1 ? 'a copy' : `${copies.length} copies`} of this
            {copies.some((entry) => entry.format) &&
              ` (${copies.map((entry) => entry.format ?? 'no medium').join(', ')})`}
            . This adds another one.
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2" aria-label="Your copy">
          <FormField id="add-ownership" label="Status">
            <Select
              value={values.ownership}
              onValueChange={(value) => set('ownership', value as OwnershipStatus)}
            >
              <SelectTrigger id="add-ownership" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OWNERSHIP_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {ownershipLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="add-quantity" label="Quantity" error={errors.quantity}>
            <Input
              id="add-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QUANTITY}
              value={values.quantity}
              onChange={(event) => set('quantity', event.target.value)}
              aria-invalid={errors.quantity ? true : undefined}
            />
          </FormField>

          <FormField id="add-acquiredAt" label="Acquired on" error={errors.acquiredAt}>
            <Input
              id="add-acquiredAt"
              type="date"
              value={values.acquiredAt}
              onChange={(event) => set('acquiredAt', event.target.value)}
              aria-invalid={errors.acquiredAt ? true : undefined}
            />
          </FormField>

          <FormField
            id="add-purchasePrice"
            label={`Purchase price (${currency})`}
            error={errors.purchasePrice}
          >
            <Input
              id="add-purchasePrice"
              inputMode="decimal"
              placeholder="0.00"
              value={values.purchasePrice}
              onChange={(event) => set('purchasePrice', event.target.value)}
              aria-invalid={errors.purchasePrice ? true : undefined}
            />
          </FormField>

          <FormField
            id="add-estimatedValue"
            label={`Estimated value (${currency})`}
            hint="Per item."
            error={errors.estimatedValue}
          >
            <Input
              id="add-estimatedValue"
              inputMode="decimal"
              placeholder="0.00"
              value={values.estimatedValue}
              onChange={(event) => set('estimatedValue', event.target.value)}
              aria-invalid={errors.estimatedValue ? true : undefined}
            />
          </FormField>

          <FormField id="add-notes" label="Notes" error={errors.notes} className="sm:col-span-2">
            <Textarea
              id="add-notes"
              rows={3}
              maxLength={MAX_NOTES_LENGTH}
              value={values.notes}
              onChange={(event) => set('notes', event.target.value)}
              aria-invalid={errors.notes ? true : undefined}
            />
          </FormField>
        </section>

        {copy ? (
          <section className="flex flex-col gap-4" aria-labelledby="add-copy-details">
            <h3 id="add-copy-details" className="text-heading">
              Copy details
            </h3>
            <CopyDetailsFields
              category={category}
              format={values.format}
              details={values.details}
              seasons={prefill.choices.seasons}
              onFormatChange={(value) => set('format', value)}
              onDetailChange={setDetail}
              markerOf={markerOf}
              errors={errors}
            />
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            Copy details (medium, quality, languages) are for copies you have. Set them when you get
            it.
          </p>
        )}
      </div>

      <DialogFooter className="m-0 border-t p-4">
        {errors.form && <p className="mr-auto text-sm text-destructive">{errors.form}</p>}
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Add to collection</Button>
      </DialogFooter>
    </form>
  );
}
