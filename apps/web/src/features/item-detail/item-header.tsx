'use client';

import { useResetOverrides } from '@fanste/collection';

import { CategoryBadge } from '@/components/items/category-badge';
import { OwnershipBadge } from '@/components/items/ownership-badge';
import { Badge } from '@/components/ui/badge';

import { EditedMarker } from './edited-marker';
import { creatorsLabel, originalValueText, showsCreators } from './item-detail-view';
import { ReleaseDetails } from './release-details';

import type { ItemDetailView } from './item-detail-view';
import type { CollectionItem, OverridableField } from '@fanste/core';

interface ItemHeaderProps {
  item: CollectionItem;
  view: ItemDetailView;
}

/**
 * The item's metadata (provider values with the user's overrides): title, subtitle, year, genres,
 * creators, description and the category's facts (`ReleaseDetails`). Overridden fields carry an
 * "edited" marker.
 */
export function ItemHeader({ item, view }: ItemHeaderProps) {
  const resetOverrides = useResetOverrides();
  const { display } = view;

  function marker(field: OverridableField, label: string) {
    if (!view.overridden.has(field)) return null;
    return (
      <EditedMarker
        field={label}
        hint={originalValueText(field, view.original, item.provider)}
        onReset={() => resetOverrides.mutate({ id: item.id, field })}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={item.category} />
        <OwnershipBadge status={item.ownership} />
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-display break-words">
          {view.title} {marker('title', 'title')}
        </h1>
        {(display?.subtitle || display?.releaseYear !== undefined) && (
          <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
            {display.subtitle && (
              <span>
                {display.subtitle} {marker('subtitle', 'subtitle')}
              </span>
            )}
            {display.releaseYear !== undefined && (
              <span>
                {display.releaseYear} {marker('releaseYear', 'year')}
              </span>
            )}
          </p>
        )}
      </div>

      {display?.genres && display.genres.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Genres">
          {display.genres.map((genre) => (
            <Badge key={genre} variant="secondary">
              {genre}
            </Badge>
          ))}
          {marker('genres', 'genres')}
        </div>
      )}

      {display?.creators && showsCreators(display) && (
        <p className="text-sm">
          <span className="text-muted-foreground">{creatorsLabel(item.category)} </span>
          {display.creators.join(', ')} {marker('creators', 'creators')}
        </p>
      )}

      {display?.description && (
        <div className="flex max-w-prose flex-col gap-1">
          <p className="text-sm leading-relaxed whitespace-pre-line">{display.description}</p>
          {marker('description', 'description')}
        </div>
      )}

      {display && <ReleaseDetails item={display} />}
    </div>
  );
}
