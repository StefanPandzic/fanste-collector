'use client';

import { MAX_NOTES_LENGTH, MAX_QUANTITY, OWNERSHIP_STATUSES, ownershipLabel } from '@fanste/core';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { FormField } from './form-field';

import type { OwnershipStatus } from '@fanste/core';

/** The copy fields an add form holds as typed. */
export interface CopyFieldsValues {
  ownership: OwnershipStatus;
  quantity: string;
  acquiredAt: string;
  purchasePrice: string;
  estimatedValue: string;
  notes: string;
}

interface CopyFieldsSectionProps {
  /** Prefix of the control ids, unique on the page. */
  idPrefix?: string;
  values: CopyFieldsValues;
  /** Errors keyed by field. */
  errors: Readonly<Record<string, string>>;
  /** The user's default currency, for the price and value. */
  currency: string;
  onChange: <K extends keyof CopyFieldsValues>(field: K, value: CopyFieldsValues[K]) => void;
}

/**
 * "Your copy" of an add form: status, quantity, acquisition date, price, value and notes. Shared by
 * "Add with details" (FC-17) and the form of hand-entered items (FC-13).
 */
export function CopyFieldsSection({
  idPrefix = 'add',
  values,
  errors,
  currency,
  onChange,
}: CopyFieldsSectionProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Your copy">
      <FormField id={`${idPrefix}-ownership`} label="Status">
        <Select
          value={values.ownership}
          onValueChange={(value) => onChange('ownership', value as OwnershipStatus)}
        >
          <SelectTrigger id={`${idPrefix}-ownership`} className="w-full">
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

      <FormField id={`${idPrefix}-quantity`} label="Quantity" error={errors.quantity}>
        <Input
          id={`${idPrefix}-quantity`}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_QUANTITY}
          value={values.quantity}
          onChange={(event) => onChange('quantity', event.target.value)}
          aria-invalid={errors.quantity ? true : undefined}
        />
      </FormField>

      <FormField id={`${idPrefix}-acquiredAt`} label="Acquired on" error={errors.acquiredAt}>
        <Input
          id={`${idPrefix}-acquiredAt`}
          type="date"
          value={values.acquiredAt}
          onChange={(event) => onChange('acquiredAt', event.target.value)}
          aria-invalid={errors.acquiredAt ? true : undefined}
        />
      </FormField>

      <FormField
        id={`${idPrefix}-purchasePrice`}
        label={`Purchase price (${currency})`}
        error={errors.purchasePrice}
      >
        <Input
          id={`${idPrefix}-purchasePrice`}
          inputMode="decimal"
          placeholder="0.00"
          value={values.purchasePrice}
          onChange={(event) => onChange('purchasePrice', event.target.value)}
          aria-invalid={errors.purchasePrice ? true : undefined}
        />
      </FormField>

      <FormField
        id={`${idPrefix}-estimatedValue`}
        label={`Estimated value (${currency})`}
        hint="Per item."
        error={errors.estimatedValue}
      >
        <Input
          id={`${idPrefix}-estimatedValue`}
          inputMode="decimal"
          placeholder="0.00"
          value={values.estimatedValue}
          onChange={(event) => onChange('estimatedValue', event.target.value)}
          aria-invalid={errors.estimatedValue ? true : undefined}
        />
      </FormField>

      <FormField
        id={`${idPrefix}-notes`}
        label="Notes"
        error={errors.notes}
        className="sm:col-span-2"
      >
        <Textarea
          id={`${idPrefix}-notes`}
          rows={3}
          maxLength={MAX_NOTES_LENGTH}
          value={values.notes}
          onChange={(event) => onChange('notes', event.target.value)}
          aria-invalid={errors.notes ? true : undefined}
        />
      </FormField>
    </section>
  );
}
