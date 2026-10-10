import { COLLECTION_SORTS, collectionFilterSchema } from '@fanste/core';

import type { CollectionFilter, CollectionSort } from '@fanste/core';
import type { z } from 'zod';

/** What the gallery shows, kept in the URL so views can be bookmarked (`/collection?…`). */
export interface GalleryState {
  filter: CollectionFilter;
  sort: CollectionSort;
}

export const DEFAULT_SORT: CollectionSort = 'added_desc';
export const DEFAULT_GALLERY_STATE: GalleryState = { filter: {}, sort: DEFAULT_SORT };

/** List filters and their URL parameter. A parameter repeats per value (`format=DVD&format=VHS`). */
const LIST_PARAMS = {
  ownership: 'ownership',
  formats: 'format',
  tagIds: 'tag',
  sources: 'source',
} as const satisfies Partial<Record<keyof CollectionFilter, string>>;

type DetailsFilter = NonNullable<CollectionFilter['details']>;

const DETAIL_PARAMS = {
  resolution: 'resolution',
  hdr: 'hdr',
  edition: 'edition',
  audioLanguages: 'audio',
  subtitleLanguages: 'subtitles',
} as const satisfies Record<keyof DetailsFilter, string>;

type RawParams = Record<string, string | string[] | undefined>;

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function first(value: string | string[] | undefined): string | undefined {
  return all(value)[0];
}

/** `value` parsed by `schema`, or `undefined` if it's missing or invalid. */
function valid<T extends z.ZodType>(schema: T, value: unknown): z.output<T> | undefined {
  if (value === undefined) return undefined;
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

/** The values of a list filter that `schema` (the list's schema) accepts, or `undefined` if none. */
function validList<T extends z.ZodType>(schema: T, values: string[]): z.output<T> | undefined {
  const kept = values.filter((value) => schema.safeParse([value]).success);
  return kept.length > 0 ? valid(schema, kept) : undefined;
}

/** Reads the page's search params; invalid values are dropped. */
export function parseGalleryState(params: RawParams): GalleryState {
  const shape = collectionFilterSchema.shape;
  const filter: CollectionFilter = {};

  const category = valid(shape.category, first(params.category));
  if (category) filter.category = category;
  for (const [key, param] of Object.entries(LIST_PARAMS) as [keyof typeof LIST_PARAMS, string][]) {
    const values = validList(shape[key].unwrap(), all(params[param]));
    if (values) (filter as Record<string, unknown>)[key] = values;
  }
  const acquiredFrom = valid(shape.acquiredFrom, first(params.from));
  if (acquiredFrom) filter.acquiredFrom = acquiredFrom;
  const acquiredTo = valid(shape.acquiredTo, first(params.to));
  if (acquiredTo) filter.acquiredTo = acquiredTo;
  const search = valid(shape.search, first(params.q));
  if (search) filter.search = search;

  const detailsShape = shape.details.unwrap().shape;
  const details: DetailsFilter = {};
  for (const [key, param] of Object.entries(DETAIL_PARAMS) as [keyof DetailsFilter, string][]) {
    const values = validList(detailsShape[key].unwrap(), all(params[param]));
    if (values) details[key] = values;
  }
  if (Object.keys(details).length > 0) filter.details = details;

  const sort = first(params.sort);
  return {
    filter,
    sort: (COLLECTION_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as CollectionSort)
      : DEFAULT_SORT,
  };
}

/** The URL of a gallery state, e.g. `/collection?category=movie&format=DVD&sort=title_asc`. */
export function galleryStateUrl({ filter, sort }: GalleryState): string {
  const params = new URLSearchParams();
  if (filter.category) params.set('category', filter.category);
  for (const [key, param] of Object.entries(LIST_PARAMS) as [keyof typeof LIST_PARAMS, string][]) {
    for (const value of filter[key] ?? []) params.append(param, value);
  }
  if (filter.acquiredFrom) params.set('from', filter.acquiredFrom);
  if (filter.acquiredTo) params.set('to', filter.acquiredTo);
  for (const [key, param] of Object.entries(DETAIL_PARAMS) as [keyof DetailsFilter, string][]) {
    for (const value of filter.details?.[key] ?? []) params.append(param, value);
  }
  if (filter.search?.trim()) params.set('q', filter.search.trim());
  if (sort !== DEFAULT_SORT) params.set('sort', sort);
  const query = params.toString();
  return query ? `/collection?${query}` : '/collection';
}

/**
 * How many filters are on, for the "Filters (3)" button. The category tabs and the search box are
 * on the page itself, so they don't count.
 */
export function activeFilterCount(filter: CollectionFilter): number {
  let count = 0;
  for (const key of Object.keys(LIST_PARAMS) as (keyof typeof LIST_PARAMS)[]) {
    if (filter[key]?.length) count += 1;
  }
  if (filter.acquiredFrom || filter.acquiredTo) count += 1;
  for (const key of Object.keys(DETAIL_PARAMS) as (keyof DetailsFilter)[]) {
    if (filter.details?.[key]?.length) count += 1;
  }
  return count;
}

/** Turns a value of a list filter on or off. An empty list removes the filter. */
export function toggleValue<T>(values: readonly T[] | undefined, value: T): T[] | undefined {
  const current = values ?? [];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return next.length > 0 ? next : undefined;
}

/** Sets one copy-details filter, dropping `details` when it ends up empty. */
export function withDetailFilter(
  filter: CollectionFilter,
  key: keyof DetailsFilter,
  values: string[] | undefined,
): CollectionFilter {
  const details: DetailsFilter = { ...filter.details, [key]: values };
  if (values === undefined) delete details[key];
  const next: CollectionFilter = { ...filter, details };
  if (Object.keys(details).length === 0) delete next.details;
  return next;
}
