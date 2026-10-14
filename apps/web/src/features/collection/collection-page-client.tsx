'use client';

import { cn } from 'cn';
import { LayoutGrid, List, PackageOpen, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  collectionErrorMessage,
  CollectionError,
  isOptimisticId,
  useBulkDeleteItems,
  useBulkUpdateItems,
  useCollectionFacets,
  useCollectionPages,
  useCustomCollections,
  useMoveItemsToCollection,
  useTagAssignment,
  useTags,
} from '@fanste/collection';
import {
  categoryLabel,
  collectionFilterSchema,
  ITEM_CATEGORIES,
  MAX_BATCH_ITEMS,
  ownershipLabel,
} from '@fanste/core';

import { CategoryIcon } from '@/components/items/category-icon';
import { CollectionIcon } from '@/components/items/collection-icon';
import { CARD_BADGES_HEIGHT } from '@/components/items/grid-layout';
import { ItemCard } from '@/components/items/item-card';
import { ItemGridSkeleton } from '@/components/items/item-card-skeleton';
import { ItemGrid } from '@/components/items/item-grid';
import { LoadMore } from '@/components/load-more';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/features/auth/session-provider';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import { FilterPanel } from './filter-panel';
import { toGalleryItem } from './gallery-items';
import { GalleryList } from './gallery-list';
import { activeFilterCount, galleryStateUrl, toggleValue } from './gallery-state';
import { SelectionBar } from './selection-bar';
import { useGalleryView } from './view-mode';

import type { GalleryItem } from './gallery-items';
import type { GalleryState } from './gallery-state';
import type {
  CollectionFilter,
  CollectionQuery,
  CollectionSort,
  CustomCollection,
  ItemCategory,
  OwnershipStatus,
} from '@fanste/core';
import type { Route } from 'next';
import type { ReactNode } from 'react';

/** Quiet time after typing before the search runs. */
const SEARCH_DEBOUNCE_MS = 300;
/** One page is one metadata batch, so it never exceeds what the batch endpoint takes. */
const GALLERY_PAGE_SIZE = MAX_BATCH_ITEMS;

const SORT_LABELS: Record<CollectionSort, string> = {
  added_desc: 'Recently added',
  added_asc: 'First added',
  title_asc: 'Title A–Z',
  title_desc: 'Title Z–A',
  year_desc: 'Release year, newest',
  year_asc: 'Release year, oldest',
  acquired_desc: 'Acquired, newest',
  acquired_asc: 'Acquired, oldest',
  value_desc: 'Value, highest',
  value_asc: 'Value, lowest',
};

const ALL_CATEGORIES = 'all';

const hrefOf = (id: string) => `/collection/${id}` as Route;

/** A gallery limited to part of the collection, on its own page, e.g. a custom collection (FC-13). */
export interface GalleryScope {
  /** Applied on top of the user's filters, and not kept in the URL. */
  filter: CollectionFilter;
  /** The page the gallery is on; its URL keeps the user's filters. */
  path: string;
  /** Replaces the gallery's heading. */
  header: ReactNode;
  /** Shown when the scope has no items at all. */
  empty: ReactNode;
}

interface CollectionPageClientProps {
  /** From the URL. */
  initialState: GalleryState;
  scope?: GalleryScope;
}

/**
 * The collection gallery (FC-18): filter, sort and search the user's items in a cover grid or a
 * compact list, and act on several at once. The database does the filtering and counting; the
 * filters are kept in the URL, so a view can be bookmarked.
 */
export function CollectionPageClient({ initialState, scope }: CollectionPageClientProps) {
  const user = useUser();
  const [view, setView] = useGalleryView(user?.id ?? 'signed-out');
  const [filter, setFilterState] = useState<CollectionFilter>(initialState.filter);
  const [sort, setSort] = useState<CollectionSort>(initialState.sort);
  const [searchInput, setSearchInput] = useState(initialState.filter.search ?? '');
  const [search] = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const userFilter: CollectionFilter = { ...filter, search: search || undefined };
  if (!search) delete userFilter.search;
  const activeFilter: CollectionFilter = { ...userFilter, ...scope?.filter };
  const url = galleryStateUrl({ filter: userFilter, sort }, scope?.path);

  // The native history API updates the URL without a server round trip (Next.js keeps in sync).
  useEffect(() => {
    window.history.replaceState(null, '', url);
  }, [url]);

  // Paging and the selection belong to one filtered view: a new filter or sort starts over.
  const [paging, setPaging] = useState({ url, count: 1 });
  const pageCount = paging.url === url ? paging.count : 1;
  const [selection, setSelection] = useState({ url, ids: new Set<string>() });

  const query: CollectionQuery = { ...activeFilter, sort, pageSize: GALLERY_PAGE_SIZE };
  const pages = useCollectionPages(query, pageCount);
  const facets = useCollectionFacets(activeFilter);
  const tags = useTags();
  const bulkDelete = useBulkDeleteItems();
  const bulkUpdate = useBulkUpdateItems();
  const moveItems = useMoveItemsToCollection();
  const { assignMany } = useTagAssignment();
  const collections = useCustomCollections();

  const items = pages.items.map(toGalleryItem);
  const loadedIds = items.map((item) => item.id).filter((id) => !isOptimisticId(id));
  // Only loaded items count: one deleted elsewhere drops out of the selection with the refetch.
  const selected = new Set(
    selection.url === url ? loadedIds.filter((id) => selection.ids.has(id)) : [],
  );
  const filterCount = activeFilterCount(filter);
  const anyFilter =
    filterCount > 0 ||
    filter.category !== undefined ||
    Boolean(filter.customCollectionIds?.length) ||
    Boolean(search);
  // "Move to collection" applies to custom items only (FC-13).
  const selectedItems = pages.items.filter((item) => selected.has(item.id));
  const movable =
    selectedItems.length > 0 && selectedItems.every((item) => item.category === 'custom');
  // When every selected item is in one collection, that one isn't a target.
  const sources = new Set(selectedItems.map((item) => item.customCollectionId));
  const moveTargets = movable
    ? (collections.data ?? []).filter(
        (collection) => sources.size !== 1 || !sources.has(collection.id),
      )
    : undefined;

  /** Applies a filter change the schema accepts, so an invalid value never reaches the queries. */
  function setFilter(next: CollectionFilter) {
    if (collectionFilterSchema.safeParse(next).success) setFilterState(next);
  }

  function clearFilters() {
    setFilter({});
    setSearchInput('');
  }

  function toggle(id: string) {
    const ids = new Set(selected);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    setSelection({ url, ids });
  }

  const clearSelection = () => setSelection({ url, ids: new Set() });

  function deleteSelected() {
    const ids = [...selected];
    clearSelection();
    bulkDelete.mutate(ids, {
      onSuccess: (count) => toast.success(`Deleted ${itemCount(count)}`),
    });
  }

  function setOwnership(ownership: OwnershipStatus) {
    const ids = [...selected];
    bulkUpdate.mutate(
      { ids, patch: { ownership } },
      {
        onSuccess: (count) =>
          toast.success(`Marked ${itemCount(count)} as ${ownershipLabel(ownership).toLowerCase()}`),
      },
    );
  }

  function moveTo(collection: CustomCollection) {
    const ids = [...selected];
    clearSelection();
    moveItems.mutate(
      { ids, collectionId: collection.id },
      { onSuccess: (count) => toast.success(`Moved ${itemCount(count)} to “${collection.name}”`) },
    );
  }

  function addTag(tagId: string) {
    const name = tags.data?.find((tag) => tag.id === tagId)?.name ?? 'the tag';
    assignMany.mutate(
      { itemIds: [...selected], tagId },
      { onSuccess: (added) => toast.success(`Tagged ${itemCount(added)} “${name}”`) },
    );
  }

  const filterPanel = (
    <FilterPanel filter={filter} facets={facets.data} tags={tags.data ?? []} onChange={setFilter} />
  );

  return (
    <div className="flex flex-col gap-6">
      {scope ? (
        scope.header
      ) : (
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Collection</h1>
            <p className="text-muted-foreground" role="status">
              {pages.total === undefined
                ? 'Everything you own, in one gallery.'
                : `${itemCount(pages.total)}${anyFilter ? ' match' : ''}`}
            </p>
          </div>
        </header>
      )}

      {!scope && (
        <CategoryTabs
          category={filter.category}
          counts={facets.data?.category}
          onChange={(category) => {
            const next = { ...filter, category };
            if (!category) delete next.category;
            // The collection chips belong to the "Custom" tab.
            if (category !== 'custom') delete next.customCollectionIds;
            setFilter(next);
          }}
        />
      )}
      {!scope && filter.category === 'custom' && (
        <CollectionChips
          collections={collections.data ?? []}
          selected={filter.customCollectionIds}
          counts={facets.data?.customCollection}
          onChange={(customCollectionIds) => {
            const next = { ...filter, customCollectionIds };
            if (!customCollectionIds) delete next.customCollectionIds;
            setFilter(next);
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search your collection"
            placeholder="Search titles"
            autoComplete="off"
            maxLength={200}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as CollectionSort)}>
          <SelectTrigger aria-label="Sort by" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="View">
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
          >
            <LayoutGrid aria-hidden />
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <List aria-hidden />
          </Button>
        </div>
        <Button variant="outline" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal aria-hidden />
          Filters{filterCount > 0 && ` (${filterCount})`}
        </Button>
        {anyFilter && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside
          aria-label="Filters"
          className="sticky top-18 hidden max-h-[calc(100svh-6rem)] overflow-y-auto pr-2 lg:block"
        >
          {filterPanel}
        </aside>

        <section aria-label="Items" aria-busy={pages.isFetching} className="flex flex-col gap-4">
          <Results
            pages={pages}
            items={items}
            view={view}
            selected={selected}
            anyFilter={anyFilter}
            empty={scope?.empty}
            onToggle={toggle}
            onClearFilters={clearFilters}
            onLoadMore={() => setPaging({ url, count: pageCount + 1 })}
          />
          {selected.size > 0 && (
            <SelectionBar
              count={selected.size}
              allSelected={loadedIds.every((id) => selected.has(id))}
              tags={tags.data ?? []}
              onSelectAll={() => setSelection({ url, ids: new Set(loadedIds) })}
              onClear={clearSelection}
              onDelete={deleteSelected}
              onSetOwnership={setOwnership}
              onAddTag={addTag}
              moveTargets={moveTargets}
              onMove={moveTo}
            />
          )}
        </section>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="gap-0">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription className="sr-only">Narrow down your collection.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">{filterPanel}</div>
          <SheetFooter className="border-t">
            <Button onClick={() => setFiltersOpen(false)}>
              {pages.total === undefined ? 'Show items' : `Show ${itemCount(pages.total)}`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function itemCount(count: number): string {
  return `${count.toLocaleString()} item${count === 1 ? '' : 's'}`;
}

interface CategoryTabsProps {
  category: ItemCategory | undefined;
  counts: Readonly<Record<string, number>> | undefined;
  onChange: (category: ItemCategory | undefined) => void;
}

/** "All" plus the categories the collection has (and the selected one), with counts. */
function CategoryTabs({ category, counts, onChange }: CategoryTabsProps) {
  const total = Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);
  const shown = ITEM_CATEGORIES.filter((entry) => (counts?.[entry] ?? 0) > 0 || entry === category);
  if (!counts && !category) return null;

  return (
    <Tabs
      value={category ?? ALL_CATEGORIES}
      onValueChange={(value) =>
        onChange(value === ALL_CATEGORIES ? undefined : (value as ItemCategory))
      }
      className="max-w-full overflow-x-auto"
    >
      <TabsList aria-label="Category">
        <TabsTrigger value={ALL_CATEGORIES} className="px-2.5">
          All
          {counts && <Count value={total} />}
        </TabsTrigger>
        {shown.map((entry) => (
          <TabsTrigger key={entry} value={entry} className="px-2.5">
            <CategoryIcon category={entry} />
            {categoryLabel(entry, { plural: true })}
            {counts && <Count value={counts[entry] ?? 0} />}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

interface CollectionChipsProps {
  collections: readonly CustomCollection[];
  selected: readonly string[] | undefined;
  counts: Readonly<Record<string, number>> | undefined;
  onChange: (ids: string[] | undefined) => void;
}

/** The "Custom" tab's sub-filter (FC-13): one chip per custom collection, with its count. */
function CollectionChips({ collections, selected, counts, onChange }: CollectionChipsProps) {
  if (collections.length === 0) return null;
  return (
    <div role="group" aria-label="Custom collection" className="flex flex-wrap gap-2">
      {collections.map((collection) => {
        const active = selected?.includes(collection.id) ?? false;
        return (
          <Button
            key={collection.id}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            aria-pressed={active}
            onClick={() => onChange(toggleValue(selected, collection.id))}
          >
            <CollectionIcon icon={collection.icon} />
            {collection.name}
            {counts && <Count value={counts[collection.id] ?? 0} />}
          </Button>
        );
      })}
    </div>
  );
}

function Count({ value }: { value: number }) {
  return <span className="text-caption text-muted-foreground tabular-nums">{value}</span>;
}

interface ResultsProps {
  pages: ReturnType<typeof useCollectionPages>;
  items: readonly GalleryItem[];
  view: 'grid' | 'list';
  selected: ReadonlySet<string>;
  anyFilter: boolean;
  /** Shown instead of the default when there are no items at all. */
  empty?: ReactNode;
  onToggle: (id: string) => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
}

function Results({
  pages,
  items,
  view,
  selected,
  anyFilter,
  empty,
  onToggle,
  onClearFilters,
  onLoadMore,
}: ResultsProps) {
  if (pages.isPending) return <ItemGridSkeleton count={12} />;

  if (pages.error && items.length === 0) {
    return (
      <ErrorState
        title="Your collection couldn't be loaded"
        description={
          pages.error instanceof CollectionError ? collectionErrorMessage(pages.error) : undefined
        }
        onRetry={pages.refetch}
      />
    );
  }

  if (items.length === 0) {
    return anyFilter ? (
      <EmptyState
        icon={SearchX}
        title="No items match"
        description="Try other filters or search words."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      (empty ?? (
        <EmptyState
          icon={PackageOpen}
          title="Your collection is empty"
          description="Find movies and TV shows and add them in one click."
          action={
            <Button asChild>
              <Link href="/search">Search to add items</Link>
            </Button>
          }
        />
      ))
    );
  }

  const selecting = selected.size > 0;
  return (
    <div className={cn('flex flex-col gap-4', pages.isPlaceholderData && 'opacity-60')}>
      {view === 'grid' ? (
        <ItemGrid
          items={items}
          getKey={(item) => item.id}
          label="Your collection"
          cardExtraHeight={CARD_BADGES_HEIGHT}
          renderItem={(item, index) => {
            const isSelected = selected.has(item.id);
            return (
              <ItemCard
                item={item.card}
                href={hrefOf(item.id)}
                priority={index < 6}
                className={cn(isSelected && 'ring-2 ring-primary')}
                badge={
                  !isOptimisticId(item.id) && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle(item.id)}
                      aria-label={`Select ${item.card.title}`}
                      className={cn(
                        'size-5 bg-background/90 shadow-sm backdrop-blur-sm transition-opacity',
                        !selecting &&
                          'opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
                      )}
                    />
                  )
                }
              />
            );
          }}
        />
      ) : (
        <GalleryList items={items} selected={selected} onToggle={onToggle} hrefOf={hrefOf} />
      )}
      <LoadMore
        hasMore={pages.hasMore}
        loading={pages.isFetchingNextPage}
        failed={pages.error !== null}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
