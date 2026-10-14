'use client';

import { Clock, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  categoryLabel,
  ITEM_CATEGORIES,
  MAX_SEARCH_CODE_LENGTH,
  MAX_SEARCH_COUNTRY_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  MUSIC_SEARCH_FORMATS,
  POPULAR_GAME_PLATFORMS,
} from '@fanste/core';

import { CategoryIcon } from '@/components/items/category-icon';
import { SEARCH_INPUT_ID } from '@/components/search-shortcut';
import { EmptyState } from '@/components/states/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/features/auth/session-provider';
import { CustomItemDialog } from '@/features/custom-item/custom-item-dialog';
import { useGamePlatforms } from '@/features/games/use-game-platforms';
import { useIsDesktop } from '@/lib/platform';
import { searchShortcutLabel } from '@/lib/shortcuts';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import { useRecentSearches } from './recent-searches';
import { SearchResults } from './search-results';
import {
  COUNTRY_SUGGESTIONS,
  isSearchable,
  parseYearInput,
  searchPlatformLabel,
  searchRequestOf,
  searchStateUrl,
} from './search-state';

import type { SearchState } from './search-state';
import type { ItemCategory, RecentSearch } from '@fanste/core';
import type { FormEvent } from 'react';

/**
 * The category tabs: every category with a provider. Custom collections have none; their items
 * are added on the collection's page (FC-13).
 */
const SEARCH_TABS = ITEM_CATEGORIES.filter((category) => category !== 'custom');

/** Quiet time after typing before a search runs. */
const SEARCH_DEBOUNCE_MS = 300;

/** The "More platforms" select without a platform from it (Radix items can't have an empty value). */
const NO_OTHER_PLATFORM = '__none__';
const POPULAR_PLATFORM_IDS: ReadonlySet<number> = new Set(
  POPULAR_GAME_PLATFORMS.map((platform) => platform.id),
);

interface SearchPageClientProps {
  /** From the URL (`?category=&q=&year=&format=&country=&code=&platform=`). */
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
  const [addingManually, setAddingManually] = useState(false);
  const [yearInput, setYearInput] = useState(initialState.year?.toString() ?? '');
  // The typed text fields settle together, so a search runs once the user stops typing.
  const typed = useMemo(
    () => ({ q: state.q, country: state.country, code: state.code }),
    [state.q, state.country, state.code],
  );
  const [debounced, flushTyped] = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS);
  const recent = useRecentSearches(user?.id ?? 'signed-out');

  // The music filters (and the game platform) are kept while the user looks at another category,
  // but only sent for their own.
  const request = searchRequestOf(state, debounced);
  const music = state.category === 'music';
  const games = state.category === 'video_game';
  // Every IGDB platform, for "More platforms" and the names in recent searches.
  const platforms = useGamePlatforms(games);

  // The native history API updates the URL without a server round trip (Next.js keeps in sync).
  useEffect(() => {
    window.history.replaceState(
      null,
      '',
      searchStateUrl({
        category: state.category,
        year: state.year,
        format: state.format,
        platform: state.platform,
        ...debounced,
      }),
    );
  }, [state.category, state.year, state.format, state.platform, debounced]);

  function rememberSearch() {
    if (request) recent.add(request);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    flushTyped(typed);
    const now = searchRequestOf(state, typed);
    if (now) recent.add(now);
  }

  function runRecent(entry: RecentSearch) {
    const next: SearchState = {
      category: entry.category,
      q: entry.q,
      year: entry.year,
      format: entry.format,
      country: entry.country,
      code: entry.code,
      platform: entry.platform,
    };
    setState(next);
    setYearInput(entry.year?.toString() ?? '');
    flushTyped({ q: next.q, country: next.country, code: next.code });
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
            {SEARCH_TABS.map((category) => {
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

        {music && (
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Medium" className="flex flex-wrap gap-2">
              {MUSIC_SEARCH_FORMATS.map((medium) => {
                const active = state.format === medium;
                return (
                  <Button
                    key={medium}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    aria-pressed={active}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        format: current.format === medium ? undefined : medium,
                      }))
                    }
                  >
                    {medium}
                  </Button>
                );
              })}
            </div>
            <Input
              list="search-countries"
              maxLength={MAX_SEARCH_COUNTRY_LENGTH}
              placeholder="Country"
              aria-label="Release country"
              value={state.country ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setState((current) => ({ ...current, country: value || undefined }));
              }}
              className="w-36"
            />
            <datalist id="search-countries">
              {COUNTRY_SUGGESTIONS.map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
            <Input
              maxLength={MAX_SEARCH_CODE_LENGTH}
              placeholder="Barcode / catalog no."
              aria-label="Barcode or catalog number"
              title="Finds the exact pressing; no title needed."
              value={state.code ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setState((current) => ({ ...current, code: value || undefined }));
              }}
              className="w-52"
            />
          </div>
        )}
        {games && (
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Platform" className="flex flex-wrap gap-2">
              {POPULAR_GAME_PLATFORMS.map((platform) => {
                const active = state.platform === platform.id;
                return (
                  <Button
                    key={platform.id}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    aria-pressed={active}
                    title={platform.name}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        platform: current.platform === platform.id ? undefined : platform.id,
                      }))
                    }
                  >
                    {platform.label}
                  </Button>
                );
              })}
            </div>
            <Select
              value={
                state.platform !== undefined && !POPULAR_PLATFORM_IDS.has(state.platform)
                  ? String(state.platform)
                  : NO_OTHER_PLATFORM
              }
              onValueChange={(value) =>
                setState((current) => ({
                  ...current,
                  platform: value === NO_OTHER_PLATFORM ? undefined : Number(value),
                }))
              }
            >
              <SelectTrigger size="sm" className="w-52" aria-label="More platforms">
                <SelectValue placeholder="More platforms…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_OTHER_PLATFORM}>More platforms…</SelectItem>
                {state.platform !== undefined &&
                  !POPULAR_PLATFORM_IDS.has(state.platform) &&
                  !platforms?.some((platform) => platform.id === state.platform) && (
                    // The active platform while the list loads (or one IGDB no longer lists).
                    <SelectItem value={String(state.platform)}>
                      {searchPlatformLabel(state.platform, platforms)}
                    </SelectItem>
                  )}
                {platforms
                  ?.filter((platform) => !POPULAR_PLATFORM_IDS.has(platform.id))
                  .map((platform) => (
                    <SelectItem key={platform.id} value={String(platform.id)}>
                      {platform.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
                key={[
                  entry.category,
                  entry.q,
                  entry.year,
                  entry.format,
                  entry.country,
                  entry.code,
                  entry.platform,
                ].join(':')}
                className="flex items-center gap-1"
              >
                <Button
                  variant="ghost"
                  className="flex-1 justify-start font-normal"
                  onClick={() => runRecent(entry)}
                >
                  <Clock aria-hidden className="text-muted-foreground" />
                  <span className="truncate">{entry.q || entry.code}</span>
                  <span className="text-caption text-muted-foreground">
                    {categoryLabel(entry.category, { plural: true })}
                    {entry.year !== undefined && ` · ${entry.year}`}
                    {entry.format !== undefined && ` · ${entry.format}`}
                    {entry.country !== undefined && ` · ${entry.country}`}
                    {entry.platform !== undefined &&
                      ` · ${searchPlatformLabel(entry.platform, platforms)}`}
                    {entry.q && entry.code !== undefined && ` · ${entry.code}`}
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

      <p className="text-center text-sm text-muted-foreground">
        Can&apos;t find it?{' '}
        <Button variant="link" className="h-auto p-0" onClick={() => setAddingManually(true)}>
          Add {categoryLabel(state.category).toLowerCase()} manually
        </Button>
      </p>
      <CustomItemDialog
        target={addingManually ? { category: state.category, customCollectionId: null } : null}
        title={`Add ${categoryLabel(state.category).toLowerCase()} manually`}
        description="For something the provider doesn't have. Only the title is required."
        currency={currency}
        onClose={() => setAddingManually(false)}
      />
    </div>
  );
}
