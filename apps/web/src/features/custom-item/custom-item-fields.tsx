'use client';

import {
  MAX_CUSTOM_DESCRIPTION_LENGTH,
  MAX_CUSTOM_IDENTIFIER_LENGTH,
  MAX_CUSTOM_SUBTITLE_LENGTH,
  MAX_CUSTOM_TITLE_LENGTH,
} from '@fanste/core';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/copy-form/form-field';
import { creatorsLabel } from '@/features/item-detail/item-detail-view';

import { ImageField } from './image-field';

import type { CustomItemFieldValues } from './custom-item-form';
import type { CustomItemField, ItemCategory } from '@fanste/core';
import type { ReactNode } from 'react';

interface CustomItemFieldsProps {
  /** Prefix of the control ids, unique on the page (e.g. `add`). */
  idPrefix: string;
  category: ItemCategory;
  values: CustomItemFieldValues;
  /** `immediate` for an upload or removal of the photo; typed text waits for a pause. */
  onChange: (field: CustomItemField, value: string, options: { immediate: boolean }) => void;
  /** Saves typed text, e.g. on blur in an autosaving form. */
  onBlur?: () => void;
  /** Errors keyed `item.<field>`. */
  errors: Readonly<Record<string, string>>;
  /** Puts the cursor in the title (a new item). */
  autoFocusTitle?: boolean;
  /** A marker next to a field's label. */
  markerOf?: (field: CustomItemField) => ReactNode;
}

/** The labels that fit the category: a custom item's maker, or a manual movie's director. */
function labelsOf(category: ItemCategory) {
  const custom = category === 'custom';
  return {
    subtitle: custom ? 'Series or line' : 'Subtitle',
    identifier: custom ? 'Number or code' : 'Catalog number',
    creators: custom ? 'Maker, brand or author' : creatorsLabel(category),
    imageUrl: custom ? 'Photo' : 'Cover',
  };
}

/**
 * The fields of a hand-entered item (FC-13): title, series, number, year, maker, description and
 * photo. Generic enough for any object; the labels follow the category.
 */
export function CustomItemFields({
  idPrefix,
  category,
  values,
  onChange,
  onBlur,
  errors,
  autoFocusTitle,
  markerOf = () => undefined,
}: CustomItemFieldsProps) {
  const labels = labelsOf(category);
  const idOf = (field: CustomItemField) => `${idPrefix}-item-${field}`;
  const control = (field: CustomItemField) => ({
    id: idOf(field),
    value: values[field],
    onChange: (event: { target: { value: string } }) =>
      onChange(field, event.target.value, { immediate: false }),
    onBlur,
    'aria-invalid': errors[`item.${field}`] ? true : undefined,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        id={idOf('title')}
        label="Title"
        marker={markerOf('title')}
        error={errors['item.title']}
        className="sm:col-span-2"
      >
        <Input
          maxLength={MAX_CUSTOM_TITLE_LENGTH}
          required
          autoFocus={autoFocusTitle}
          {...control('title')}
        />
      </FormField>

      <FormField
        id={idOf('subtitle')}
        label={labels.subtitle}
        marker={markerOf('subtitle')}
        error={errors['item.subtitle']}
      >
        <Input maxLength={MAX_CUSTOM_SUBTITLE_LENGTH} {...control('subtitle')} />
      </FormField>

      <FormField
        id={idOf('identifier')}
        label={labels.identifier}
        hint={category === 'custom' ? 'e.g. #123 or 75192.' : undefined}
        marker={markerOf('identifier')}
        error={errors['item.identifier']}
      >
        <Input maxLength={MAX_CUSTOM_IDENTIFIER_LENGTH} {...control('identifier')} />
      </FormField>

      <FormField
        id={idOf('releaseYear')}
        label="Year"
        marker={markerOf('releaseYear')}
        error={errors['item.releaseYear']}
      >
        <Input inputMode="numeric" maxLength={4} {...control('releaseYear')} />
      </FormField>

      <FormField
        id={idOf('creators')}
        label={labels.creators}
        hint="Separate the names with commas."
        marker={markerOf('creators')}
        error={errors['item.creators']}
      >
        <Input maxLength={2100} {...control('creators')} />
      </FormField>

      <FormField
        id={idOf('description')}
        label="Description"
        marker={markerOf('description')}
        error={errors['item.description']}
        className="sm:col-span-2"
      >
        <Textarea rows={4} maxLength={MAX_CUSTOM_DESCRIPTION_LENGTH} {...control('description')} />
      </FormField>

      <FormField
        id={idOf('imageUrl')}
        label={labels.imageUrl}
        marker={markerOf('imageUrl')}
        error={errors['item.imageUrl']}
        className="sm:col-span-2"
      >
        <ImageField
          id={idOf('imageUrl')}
          value={values.imageUrl}
          onChange={(value, options) => onChange('imageUrl', value, options)}
          onBlur={onBlur}
          invalid={errors['item.imageUrl'] !== undefined}
        />
      </FormField>
    </div>
  );
}
