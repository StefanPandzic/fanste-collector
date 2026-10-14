'use client';

import { cn } from 'cn';
import { useState } from 'react';

import { useCustomCollectionMutations, useCustomCollections } from '@fanste/collection';
import {
  CUSTOM_COLLECTION_ICONS,
  customCollectionInputSchema,
  DEFAULT_COLLECTION_ICON,
  isCollectionNameTaken,
  MAX_COLLECTION_DESCRIPTION_LENGTH,
  MAX_COLLECTION_NAME_LENGTH,
} from '@fanste/core';

import { CollectionIcon } from '@/components/items/collection-icon';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/features/copy-form/form-field';

import type { CustomCollection, CustomCollectionIcon } from '@fanste/core';
import type { FormEvent } from 'react';

interface CollectionDialogProps {
  open: boolean;
  /** The collection to edit; a new one is created when it's missing. */
  collection?: CustomCollection;
  onClose: () => void;
  /** A new collection was stored. */
  onCreated?: (collection: CustomCollection) => void;
}

/** Creates a custom collection or edits one (FC-13): name, icon and description. */
export function CollectionDialog({ open, collection, onClose, onCreated }: CollectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{collection ? 'Edit collection' : 'New collection'}</DialogTitle>
          <DialogDescription>
            A collection for anything you collect: Funko Pops, LEGO sets, comics, coins, …
          </DialogDescription>
        </DialogHeader>
        {open && <CollectionForm collection={collection} onClose={onClose} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  );
}

function CollectionForm({ collection, onClose, onCreated }: Omit<CollectionDialogProps, 'open'>) {
  const collections = useCustomCollections();
  const { create, update } = useCustomCollectionMutations();
  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [icon, setIcon] = useState<CustomCollectionIcon>(
    collection?.icon ?? DEFAULT_COLLECTION_ICON,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = customCollectionInputSchema.safeParse({ name, description, icon });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      setErrors({
        ...(fields.has('name') && {
          name: `Enter a name of 1 to ${MAX_COLLECTION_NAME_LENGTH} characters.`,
        }),
        ...(fields.has('description') && {
          description: `The description can be at most ${MAX_COLLECTION_DESCRIPTION_LENGTH} characters.`,
        }),
      });
      return;
    }
    if (isCollectionNameTaken(parsed.data.name, collections.data ?? [], collection?.id)) {
      setErrors({ name: 'You already have a collection with this name.' });
      return;
    }
    if (collection) {
      // Optimistic: the new name shows at once; the collection provider reports a failure.
      update.mutate({ id: collection.id, patch: parsed.data });
      onClose();
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (created) => {
        onClose();
        onCreated?.(created);
      },
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField id="collection-name" label="Name" error={errors.name}>
        <Input
          id="collection-name"
          autoFocus
          maxLength={MAX_COLLECTION_NAME_LENGTH}
          placeholder="e.g. Funko Pops"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setErrors(({ name: _removed, ...rest }) => rest);
          }}
          aria-invalid={errors.name ? true : undefined}
        />
      </FormField>

      <fieldset className="flex flex-col gap-1.5">
        <Label asChild>
          <legend>Icon</legend>
        </Label>
        <div role="radiogroup" aria-label="Icon" className="grid grid-cols-7 gap-1">
          {CUSTOM_COLLECTION_ICONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={icon === option}
              aria-label={option.replace('-', ' ')}
              onClick={() => setIcon(option)}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md border text-muted-foreground transition-colors outline-none',
                'hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                icon === option && 'border-primary bg-primary/10 text-foreground',
              )}
            >
              <CollectionIcon icon={option} className="size-4" />
            </button>
          ))}
        </div>
      </fieldset>

      <FormField id="collection-description" label="Description" error={errors.description}>
        <Textarea
          id="collection-description"
          rows={3}
          maxLength={MAX_COLLECTION_DESCRIPTION_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={errors.description ? true : undefined}
        />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {collection ? 'Save' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}
