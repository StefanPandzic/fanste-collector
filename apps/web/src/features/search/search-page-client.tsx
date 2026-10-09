'use client';

import { Clock, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { categoryLabel, ITEM_CATEGORIES, MAX_SEARCH_QUERY_LENGTH } from '@fanste/core';

import { CategoryIcon } from '@/components/items/category-icon';
import { SEARCH_INPUT_ID } from '@/components/search-shortcut';
import { EmptyState } from '@/components/states/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/features/auth/session-provider';
import { useIsDesktop } from '@/lib/platform';
import { searchShortcutLabel } from '@/lib/shortcuts';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import { useRecentSearches } from './recent-searches';
import { SearchResults } from './search-results';
import { isSearchable, parseYearInput, searchStateUrl } from './search-state';

import type { SearchState } from './search-state';
import type { SearchRequest } from './use-search-results';
import type { ItemCategory, RecentSearch } from '@fanste/core';
import type { FormEvent } from 'react';

/** Quiet time after typing before a search runs. */
const SEARCH_DEBOUNCE_MS = 300;

interface SearchPageClientProps {
  /** From the URL (`?category=&q=&year=`). */
  initialState: SearchState;
  /** The user's default currency, for prices in the add dialog. */
  currency: string;
}

/**
 * Unified search (FC-17): pick a category, type, and add results to the collection. The search is
 * kept in the URL, so Back and shared links restore it.
 */
export function SearchPageClient({ initialState, currency }: SearchPageClientProps) {
  const router = useRouter();
  const user = useUser();
  const isDesktop = useIsDesktop();
  const [state, setState] = useState(initialState);
  const [yearInput, setYearInput] = useState(initialState.year?.toString() ?? '');
  const [debouncedQ, flushQ] = useDebouncedValue(state.q, SEARCH_DEBOUNCE_MS);
  const recent = useRecentSearches(user?.id ?? 'signed-out');

  const q = debouncedQ.trim();
  const request: SearchRequest | null = q
    ? { category: state.category, q, ...(state.year !== undefined ? { year: state.year } : {}) }
    : null;

  // The native history API updates the URL without a server round trip (Next.js keeps in sync).
  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      searchStateUrl({ category: state.category, q: debouncedQ, year: state.year }),
    );
  }, [state.category, debouncedQ, state.year]);

  function rememberSearch() {
    if (request) recent.add(request);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    flushQ(state.q);
    const trimmed = state.q.trim();
    if (trimmed) recent.add({ category: state.category, q: trimmed, year: state.year });
  }

  function runRecent(entry: RecentSearch) {
    setState({ category: entry.category, q: entry.q, year: entry.year });
    setYearInput(entry.year?.toString() ?? '');
    flushQ(entry.q);
  }

  function showAdded(title: string) {
    toast.success(`Added “${title}” to your collection`, {
      action: { label: 'View', onClick: () => router.push('/collection') },
    });
  }

  const label = categoryLabel(state.category, { plural: true }).toLowerCase();
  const os = isDesktop ? window.fanste?.platform.os : undefined;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-muted-foreground">Find something and add it to your collection.</p>
      </header>

      <div className="flex flex-col gap-3">
        <Tabs
          value={state.category}
          onValueChange={(value) =>
            setState((current) => ({ ...current, category: value as ItemCategory }))
          }
          className="max-w-full overflow-x-auto"
        >
          <TabsList aria-label="Category">
            {ITEM_CATEGORIES.map((category) => {
              const enabled = isSearchable(category);
              return (
                <TabsTrigger
                  key={category}
                  value={category}
                  disabled={!enabled}
                  title={enabled ? undefined : 'Coming soon'}
                  className="px-2.5"
                >
                  <CategoryIcon category={category} />
                  {categoryLabel(category, { plural: true })}
                  {!enabled && <span className="text-caption text-muted-foreground">Soon</span>}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <form role="search" onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={SEARCH_INPUT_ID}
              type="search"
              // The page is opened to search, also with the desktop shortcut.
              autoFocus
              autoComplete="off"
              maxLength={MAX_SEARCH_QUERY_LENGTH}
              placeholder={`Search ${label}…`}
              aria-label={`Search ${label}`}
              value={state.q}
              onChange={(event) => {
                const value = event.target.value;
                setState((current) => ({ ...current, q: value }));
              }}
              className="pl-9"
            />
            {os && (
              <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 text-caption text-muted-foreground sm:block">
                {searchShortcutLabel(os)}
              </kbd>
            )}
          </div>
          <Input
            inputMode="numeric"
            maxLength={4}
            placeholder="Year"
            aria-label="Release year"
            value={yearInput}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, '');
              setYearInput(value);
              setState((current) => ({ ...current, year: parseYearInput(value) }));
            }}
            className="w-24"
          />
        </form>
      </div>

      {request ? (
        <SearchResults
          request={request}
          currency={currency}
          onResultUsed={rememberSearch}
          onAdded={showAdded}
        />
      ) : recent.recent.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby="recent-searches">
          <div className="flex items-center justify-between">
            <h2 id="recent-searches" className="text-heading">
              Recent searches
            </h2>
            <Button variant="ghost" size="sm" onClick={recent.clear}>
              Clear
            </Button>
          </div>
          <ul className="flex flex-col">
            {recent.recent.map((entry) => (
              <li
                key={`${entry.category}:${entry.q}:${entry.year ?? ''}`}
                className="flex items-center gap-1"
              >
                <Button
                  variant="ghost"
                  className="flex-1 justify-start font-normal"
                  onClick={() => runRecent(entry)}
                >
                  <Clock aria-hidden className="text-muted-foreground" />
                  <span className="truncate">{entry.q}</span>
                  <span className="text-caption text-muted-foreground">
                    {categoryLabel(entry.category, { plural: true })}
                    {entry.year !== undefined && ` · ${entry.year}`}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => recent.remove(entry)}
                  aria-label={`Remove “${entry.q}” from recent searches`}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState
          icon={Search}
          title={`Search ${label}`}
          description="Type a title. Results come with their cover art, and one click adds them to your collection."
        />
      )}
    </div>
  );
}
