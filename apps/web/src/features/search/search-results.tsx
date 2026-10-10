'use client';

import { Check, CopyPlus, Loader2, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';

import { refKey, useCollectionCopies } from '@fanste/collection';
import { categoryLabel, providerLabel, providerOfCategory } from '@fanste/core';

import { ItemCard } from '@/components/items/item-card';
import { ItemGridSkeleton } from '@/components/items/item-card-skeleton';
import { ItemGrid } from '@/components/items/item-grid';
import { LoadMore } from '@/components/load-more';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { AddItemDialog } from './add-item-dialog';
import { targetOf } from './add-item-form';
import { retryingText, searchErrorText } from './search-errors';
import { flattenResults } from './search-state';
import { useQuickAdd } from './use-quick-add';
import { useSearchResults } from './use-search-results';

import type { AddTarget } from './add-item-form';
import type { SearchRequest } from './use-search-results';
import type { ItemCopy } from '@fanste/collection';
import type { SearchResult } from '@fanste/core';

interface SearchResultsProps {
  request: SearchRequest;
  currency: string;
  /** Called when the user acts on a result (opens or adds it), to remember the search. */
  onResultUsed: () => void;
  onAdded: (title: string) => void;
}

const NO_COPIES: readonly ItemCopy[] = [];

/** Provider results of a search as cover cards, with quick add and "Add with details". */
export function SearchResults({ request, currency, onResultUsed, onAdded }: SearchResultsProps) {
  const query = useSearchResults(request);
  const results = flattenResults(query.data?.pages ?? []);
  const targets = results.flatMap((result) => targetOf(result) ?? []);
  const copies = useCollectionCopies(targets);
  const { quickAdd, isPending } = useQuickAdd({ onAdded });
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const provider = providerLabel(providerOfCategory(request.category) ?? 'custom');
  const copiesOf = (target: AddTarget | undefined) =>
    (target && copies.data?.[refKey(target)]) ?? NO_COPIES;

  function open(result: SearchResult) {
    onResultUsed();
    setSelected(result);
  }

  const selectedTarget = selected ? (targetOf(selected) ?? null) : null;
  const dialog = (
    <AddItemDialog
      result={selected}
      target={selectedTarget}
      copies={selectedTarget ? copiesOf(selectedTarget) : NO_COPIES}
      currency={currency}
      onClose={() => setSelected(null)}
      onAdded={onAdded}
    />
  );

  const retrying = query.isFetching && query.failureCount > 0 && query.failureReason;

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        {retrying && <RetryBanner text={retryingText(query.failureReason, provider)} />}
        <ItemGridSkeleton count={12} />
      </div>
    );
  }

  if (query.isError && results.length === 0) {
    const text = searchErrorText(query.error, provider);
    return (
      <ErrorState
        title={text.title}
        description={text.description}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No results"
        description={`${provider} has no ${categoryLabel(request.category, { plural: true }).toLowerCase()} matching “${request.q}”${request.year ? ` from ${request.year}` : ''}. Check the spelling or try fewer words.`}
      />
    );
  }

  const total = query.data?.pages[0]?.totalResults ?? results.length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" role="status">
        {total.toLocaleString()} result{total === 1 ? '' : 's'} from {provider}
      </p>
      {retrying && <RetryBanner text={retryingText(query.failureReason, provider)} />}

      <ItemGrid
        items={results}
        getKey={(result) => `${result.provider}:${result.externalId}`}
        label="Search results"
        renderItem={(result, index) => {
          const target = targetOf(result);
          const owned = copiesOf(target);
          return (
            <ItemCard
              item={result}
              priority={index < 6}
              onSelect={() => open(result)}
              badge={owned.length > 0 && <InCollectionBadge copies={owned} />}
              action={
                target && (
                  <QuickAddButton
                    title={result.title}
                    pending={isPending(target)}
                    owned={owned.length > 0}
                    onClick={() => {
                      if (owned.length > 0) {
                        // Another copy needs its own medium, so it goes through the dialog.
                        open(result);
                      } else {
                        onResultUsed();
                        void quickAdd(target);
                      }
                    }}
                  />
                )
              }
            />
          );
        }}
      />

      <LoadMore
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        failed={query.isFetchNextPageError}
        onLoadMore={() => void query.fetchNextPage()}
      />
      {dialog}
    </div>
  );
}

function RetryBanner({ text }: { text: string }) {
  return (
    <p
      className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"
      role="status"
    >
      <Loader2 aria-hidden className="size-4 animate-spin" />
      {text}
    </p>
  );
}

function InCollectionBadge({ copies }: { copies: readonly ItemCopy[] }) {
  const wishlistOnly = copies.every((copy) => copy.ownership === 'wishlist');
  return (
    <Badge className="bg-background/90 text-foreground shadow-sm backdrop-blur-sm">
      <Check aria-hidden className="text-success" />
      {wishlistOnly ? 'On wishlist' : 'In collection'}
      {copies.length > 1 && ` · ${copies.length}`}
    </Badge>
  );
}

interface QuickAddButtonProps {
  title: string;
  pending: boolean;
  owned: boolean;
  onClick: () => void;
}

function QuickAddButton({ title, pending, owned, onClick }: QuickAddButtonProps) {
  const label = owned ? `Add another copy of ${title}` : `Quick add ${title}`;
  return (
    <Button
      type="button"
      size="icon"
      className="rounded-full shadow-md"
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      title={owned ? 'Add another copy' : 'Quick add'}
    >
      {pending ? (
        <Loader2 aria-hidden className="animate-spin" />
      ) : owned ? (
        <CopyPlus aria-hidden />
      ) : (
        <Plus aria-hidden />
      )}
    </Button>
  );
}
