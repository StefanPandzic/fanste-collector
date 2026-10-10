'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { CATEGORY_META, ITEM_CATEGORIES, OWNERSHIP_STATUSES } from '@fanste/core';

import { CategoryBadge } from '@/components/items/category-badge';
import { ItemCard } from '@/components/items/item-card';
import { ItemCardSkeleton } from '@/components/items/item-card-skeleton';
import { ItemGrid } from '@/components/items/item-grid';
import { OwnershipBadge } from '@/components/items/ownership-badge';
import { TagChip } from '@/components/items/tag-chip';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { mockItems } from './mock-items';

import type { ReactNode } from 'react';

const GRID_ITEMS = mockItems(1000);
const SAMPLE_ITEMS = mockItems(ITEM_CATEGORIES.length);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-heading">{title}</h2>
      {children}
    </section>
  );
}

/** Every shared component on one page, for checking light/dark mode and the desktop app. */
export function DesignShowcase() {
  const [tags, setTags] = useState(['4K', 'Steelbook', 'Signed']);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">Design system</h1>
        <p className="text-muted-foreground">
          Development only. Toggle the theme to check both modes.
        </p>
      </header>

      <Section title="Category accents">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ITEM_CATEGORIES.map((category) => (
            <div key={category} className="flex flex-col gap-2 rounded-lg border p-3">
              <CategoryBadge category={category} />
              <span className="text-caption text-muted-foreground">
                {CATEGORY_META[category].accent}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Badges & tags">
        <div className="flex flex-wrap gap-2">
          {OWNERSHIP_STATUSES.map((status) => (
            <OwnershipBadge key={status} status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ITEM_CATEGORIES.map((category) => (
            <CategoryBadge key={category} category={category} iconOnly />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagChip
              key={tag}
              label={tag}
              onRemove={() => setTags((current) => current.filter((t) => t !== tag))}
            />
          ))}
          <TagChip label="Read-only tag" />
        </div>
      </Section>

      <Section title="Tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="w-fit">
                Hover or focus me
              </Button>
            </TooltipTrigger>
            <TooltipContent>Short hints, e.g. a field&apos;s original value.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
          {SAMPLE_ITEMS.map((item) => (
            <ItemCard key={item.id} item={item} onSelect={() => toast(`Selected ${item.title}`)} />
          ))}
          <ItemCard item={{ title: 'Not clickable', category: 'funko' }} />
          <ItemCard
            item={{
              title: 'With copy badges',
              category: 'movie',
              releaseYear: 2010,
              ownership: 'owned',
              badges: ['4K UHD', 'Dolby Vision', 'Steelbook', '2 discs'],
            }}
            onSelect={() => toast('Selected the card')}
          />
          <ItemCard
            item={{ title: 'With badge and action', category: 'movie', releaseYear: 2010 }}
            onSelect={() => toast('Selected the card')}
            badge={
              <Badge className="bg-background/90 text-foreground shadow-sm">In collection</Badge>
            }
            action={
              <Button
                size="icon"
                className="rounded-full shadow-md"
                aria-label="Quick add"
                onClick={() => toast('Quick add')}
              >
                <Plus aria-hidden />
              </Button>
            }
          />
          <ItemCardSkeleton />
        </div>
      </Section>

      <Section title="States">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            icon={Search}
            title="Your collection is empty"
            description="Search to add your first item."
            action={<Button>Search</Button>}
          />
          <ErrorState
            description="Discogs is busy right now. Try again in a minute."
            onRetry={() => toast('Retrying…')}
          />
        </div>
      </Section>

      <Section title={`Virtualized grid (${GRID_ITEMS.length} items)`}>
        <p className="text-sm text-muted-foreground">
          Only the rows near the viewport are in the DOM. Focus a card and use the arrow keys, Home
          and End.
        </p>
        <ItemGrid
          label="Mock items"
          items={GRID_ITEMS}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <ItemCard item={item} onSelect={() => toast(`Selected ${item.title}`)} />
          )}
        />
      </Section>
    </div>
  );
}
