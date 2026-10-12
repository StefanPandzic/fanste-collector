'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useItemFileDetails, useUpdateItem, useUpdateItemDetails } from '@fanste/collection';
import {
  CURRENCIES,
  MAX_NOTES_LENGTH,
  MAX_QUANTITY,
  OWNERSHIP_STATUSES,
  ownershipLabel,
  parseDetails,
  parseTvExtra,
} from '@fanste/core';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CopyDetailsFields } from '@/features/copy-form/copy-details-fields';
import { showsCopyDetails, staleVinylFields } from '@/features/copy-form/copy-form';
import type { CopyFormDetails } from '@/features/copy-form/copy-form';
import { FormField } from '@/features/copy-form/form-field';
import { MusicDetailsFields } from '@/features/copy-form/music-details-fields';

import { EditedMarker } from './edited-marker';
import {
  copyFieldValues,
  detailsCategory,
  fileMarkerOf,
  FROM_FILE_LABEL,
  toCopyPatch,
  toDetailsPatch,
} from './item-detail-view';
import { SeasonsEditor } from './seasons-editor';
import { TagPicker } from './tag-picker';
import { useAutosave } from './use-autosave';

import type { CopyFieldValues } from './item-detail-view';
import type { Autosave } from './use-autosave';
import type { DetailsChange } from '@fanste/collection';
import type {
  CollectionItem,
  FileDetailField,
  NormalizedItem,
  OwnershipStatus,
} from '@fanste/core';

/** Names of the details a file's headers fill, for the reset buttons' accessible names. */
const FILE_FIELD_NAMES: Record<FileDetailField, string> = {
  fileFormat: 'file format',
  resolution: 'resolution',
  hdr: 'HDR',
  audioChannels: 'audio channels',
  audioLanguages: 'audio languages',
  subtitleLanguages: 'subtitle languages',
};

// Radix Select items can't have an empty value.
const NO_CURRENCY = '__none__';

interface CopySectionProps {
  item: CollectionItem;
  /** The provider item (TMDB seasons for the TV editor). */
  metadata: NormalizedItem | undefined;
  /** The user's default currency, set with a first price or value. */
  defaultCurrency: string;
}

/**
 * "My copy" (FC-19): the copy fields, tags and the category's copy details (FC-15). Every field
 * saves on its own: pickers at once, text after a pause or when it loses focus. Details the scanner
 * read from the file's own headers are marked "from file", and "edited" with a reset to the file's
 * value once changed (FC-23).
 */
export function CopySection({ item, metadata, defaultCurrency }: CopySectionProps) {
  const updateItem = useUpdateItem();
  const updateDetails = useUpdateItemDetails();
  const category = detailsCategory(item.category);

  // The latest autosaves, for work that runs once a save has finished.
  const latest = useRef<{ copy: Autosave<CopyFieldValues>; details: Autosave<CopyFormDetails> }>(
    undefined,
  );

  /**
   * Once a record's new medium is saved, removes the vinyl details it no longer shows (size, speed,
   * variant), so a CD never matches a vinyl-size filter. Only after the save: if it fails, the copy
   * is still vinyl and keeps them. The medium may have changed again meanwhile, so the current one
   * decides.
   */
  function clearStaleVinylDetails() {
    const current = latest.current;
    if (!current || category !== 'music') return;
    const stale = staleVinylFields(current.copy.values.format, current.details.values);
    if (stale.length === 0) return;
    for (const field of stale) current.details.set(field, undefined);
    current.details.flush();
  }

  const copy = useAutosave(copyFieldValues(item), (changes, onSettled) => {
    const { patch, errors } = toCopyPatch(changes, item, defaultCurrency);
    if (Object.keys(patch).length > 0) {
      updateItem.mutateAsync({ id: item.id, patch }).then(() => {
        onSettled();
        if (patch.format !== undefined) clearStaleVinylDetails();
      }, onSettled);
    } else {
      onSettled();
    }
    return errors;
  });

  const details = useAutosave<CopyFormDetails>(
    parseDetails(category, item.details),
    (changes, onSettled) => {
      const { patch, errors } = toDetailsPatch(category, changes);
      if (Object.keys(patch).length > 0) {
        const change = { category, changes: patch } as DetailsChange;
        updateDetails.mutateAsync({ id: item.id, change }).then(onSettled, onSettled);
      } else {
        onSettled();
      }
      return errors;
    },
    (key) => key.replace(/^details\./, ''),
  );

  useEffect(() => {
    latest.current = { copy, details };
  });

  const values = copy.values;
  const detailErrors = {
    ...details.errors,
    ...(copy.errors.format ? { format: copy.errors.format } : {}),
  };
  const shownCurrency = values.currency || defaultCurrency;
  const hasDetails = showsCopyDetails(values.ownership);
  const readOnly = values.ownership === 'sold';

  const fileDetails = useItemFileDetails(item.id);
  const recorded = useMemo(() => fileDetails.data ?? {}, [fileDetails.data]);

  function markerOf(field: string) {
    const marker = fileMarkerOf(field, details.values[field as keyof CopyFormDetails], recorded);
    if (!marker) return undefined;
    if (marker.kind === 'file') return FROM_FILE_LABEL;
    return (
      <EditedMarker
        hint={marker.hint}
        field={FILE_FIELD_NAMES[field as FileDetailField]}
        resetTo="the file's value"
        onReset={
          readOnly
            ? undefined
            : () =>
                details.set(field as keyof CopyFormDetails, marker.fileValue, {
                  immediate: true,
                })
        }
      />
    );
  }

  function textProps<K extends 'quantity' | 'acquiredAt' | 'purchasePrice' | 'estimatedValue'>(
    field: K,
  ) {
    return {
      id: `item-${field}`,
      value: values[field],
      onChange: (event: { target: { value: string } }) => copy.set(field, event.target.value),
      onBlur: copy.flush,
      'aria-invalid': copy.errors[field] ? true : undefined,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4" aria-labelledby="item-my-copy">
        <h2 id="item-my-copy" className="text-heading">
          My copy
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="item-ownership" label="Status">
            <Select
              value={values.ownership}
              onValueChange={(value) =>
                copy.set('ownership', value as OwnershipStatus, { immediate: true })
              }
            >
              <SelectTrigger id="item-ownership" className="w-full">
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

          <FormField id="item-quantity" label="Quantity" error={copy.errors.quantity}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_QUANTITY}
              {...textProps('quantity')}
            />
          </FormField>

          <FormField id="item-acquiredAt" label="Acquired on" error={copy.errors.acquiredAt}>
            <Input type="date" {...textProps('acquiredAt')} />
          </FormField>

          <FormField
            id="item-purchasePrice"
            label={`Purchase price (${shownCurrency})`}
            error={copy.errors.purchasePrice}
          >
            <Input inputMode="decimal" placeholder="0.00" {...textProps('purchasePrice')} />
          </FormField>

          <FormField
            id="item-estimatedValue"
            label={`Estimated value (${shownCurrency})`}
            hint="Per item."
            error={copy.errors.estimatedValue}
          >
            <Input inputMode="decimal" placeholder="0.00" {...textProps('estimatedValue')} />
          </FormField>

          <FormField id="item-currency" label="Currency" error={copy.errors.currency}>
            <Select
              value={values.currency || NO_CURRENCY}
              onValueChange={(value) =>
                copy.set('currency', value === NO_CURRENCY ? '' : value, { immediate: true })
              }
            >
              <SelectTrigger id="item-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CURRENCY}>Not set</SelectItem>
                {/* A code stored earlier that the list doesn't offer stays selectable. */}
                {[
                  ...new Set<string>([...CURRENCIES, ...(item.currency ? [item.currency] : [])]),
                ].map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="item-notes"
            label="Notes"
            error={copy.errors.notes}
            className="sm:col-span-2 lg:col-span-3"
          >
            <Textarea
              id="item-notes"
              rows={3}
              maxLength={MAX_NOTES_LENGTH}
              value={values.notes}
              onChange={(event) => copy.set('notes', event.target.value)}
              onBlur={copy.flush}
              aria-invalid={copy.errors.notes ? true : undefined}
            />
          </FormField>

          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-sm font-medium">Tags</span>
            <TagPicker itemId={item.id} tagIds={item.tagIds} disabled={readOnly} />
          </div>
        </div>
      </section>

      {hasDetails || readOnly ? (
        <section className="flex flex-col gap-4" aria-labelledby="item-copy-details">
          <h2 id="item-copy-details" className="text-heading">
            Copy details
          </h2>
          {readOnly && (
            <p className="text-sm text-muted-foreground">
              This copy is sold, so its details are read-only. Change the status to edit them.
            </p>
          )}
          {category === 'music' ? (
            <MusicDetailsFields
              idPrefix="item"
              format={values.format}
              details={details.values}
              onFormatChange={(value, options) => copy.set('format', value, options)}
              onDetailChange={(field, value, options) => details.set(field, value, options)}
              markerOf={markerOf}
              errors={detailErrors}
              disabled={readOnly}
            />
          ) : (
            <CopyDetailsFields
              idPrefix="item"
              category={category}
              format={values.format}
              details={details.values}
              onFormatChange={(value, options) => copy.set('format', value, options)}
              onDetailChange={(field, value, options) => details.set(field, value, options)}
              markerOf={markerOf}
              errors={detailErrors}
              disabled={readOnly}
            />
          )}
          {category === 'tv' && (
            <section className="flex flex-col gap-3" aria-labelledby="item-seasons">
              <h3 id="item-seasons" className="text-sm font-medium">
                Seasons owned
              </h3>
              <SeasonsEditor
                details={details.values}
                format={values.format}
                tvExtra={parseTvExtra(metadata?.extra)}
                onChange={(seasons, options) => details.set('seasons', seasons, options)}
                error={details.errors['details.seasons']}
                disabled={readOnly}
              />
            </section>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Copy details (
          {category === 'music' ? 'medium, pressing, condition' : 'medium, quality, languages'}) are
          for copies you have. They are kept while the item is on your wishlist; change the status
          to see them.
        </p>
      )}
    </div>
  );
}
