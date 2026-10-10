'use client';

import { useMemo } from 'react';

import { CollectionError, collectionErrorMessage, useCollectionStats } from '@fanste/collection';

import { ErrorState } from '@/components/states/error-state';
import { Skeleton } from '@/components/ui/skeleton';

import { CategoryCards } from './category-cards';
import { AddedPerMonthChart, ValueByCategoryChart } from './dashboard-charts';
import { DashboardOnboarding } from './dashboard-onboarding';
import {
  categoryCards,
  categoryValues,
  isEmptyCollection,
  monthBars,
  valueSummary,
} from './dashboard-view';
import { RecentlyAdded } from './recently-added';
import { StatTiles } from './stat-tiles';

import type { CollectionStats } from '@fanste/collection';

interface DashboardPageClientProps {
  /** The user's default currency, the one the value is shown in. */
  currency: string;
}

/**
 * The overview of the whole collection. Every number comes from one `collection_stats()` call,
 * which Realtime refreshes when items change on any device.
 */
export function DashboardPageClient({ currency }: DashboardPageClientProps) {
  const stats = useCollectionStats();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">An overview of your collection.</p>
      </header>
      {stats.isPending ? (
        <DashboardSkeleton />
      ) : stats.isError ? (
        <ErrorState
          title="Your dashboard couldn't be loaded"
          description={
            stats.error instanceof CollectionError ? collectionErrorMessage(stats.error) : undefined
          }
          onRetry={() => void stats.refetch()}
        />
      ) : isEmptyCollection(stats.data) ? (
        <DashboardOnboarding />
      ) : (
        <Overview stats={stats.data} currency={currency} />
      )}
    </div>
  );
}

function Overview({ stats, currency }: { stats: CollectionStats; currency: string }) {
  const view = useMemo(() => {
    const value = valueSummary(stats, currency);
    return {
      value,
      cards: categoryCards(stats),
      months: monthBars(stats.addedByMonth),
      values: categoryValues(stats, currency),
    };
  }, [stats, currency]);

  return (
    <>
      <StatTiles stats={stats} value={view.value} />
      <section aria-labelledby="categories" className="flex flex-col gap-3">
        <h2 id="categories" className="text-heading">
          Categories
        </h2>
        <CategoryCards cards={view.cards} />
      </section>
      <RecentlyAdded />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AddedPerMonthChart bars={view.months} />
        <ValueByCategoryChart
          rows={view.values}
          currency={currency}
          hasOtherCurrencies={view.value.others.length > 0}
        />
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-18 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
