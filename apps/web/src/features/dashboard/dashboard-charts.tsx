import { cn } from 'cn';

import { categoryClasses } from '@/components/items/category-style';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/features/collection/gallery-items';

import type { BarView, CategoryValueView } from './dashboard-view';

/** Items added per month as vertical bars. The list carries the numbers for screen readers. */
export function AddedPerMonthChart({ bars }: { bars: readonly BarView[] }) {
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Added per month</CardTitle>
        <CardDescription>
          {total.toLocaleString()} {total === 1 ? 'item' : 'items'} in the last {bars.length} months
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol aria-label="Items added per month" className="flex h-44 items-end gap-1.5">
          {bars.map((bar) => (
            <li
              key={bar.key}
              aria-label={bar.description}
              title={bar.description}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span aria-hidden className="text-caption text-muted-foreground tabular-nums">
                {bar.value > 0 ? bar.value : ''}
              </span>
              <span
                aria-hidden
                className={cn('w-full rounded-t-sm', bar.value > 0 ? 'bg-primary' : 'bg-muted')}
                style={{ height: bar.value > 0 ? `${Math.max(bar.ratio * 100, 4)}%` : '2px' }}
              />
              <span aria-hidden className="truncate text-caption text-muted-foreground">
                {bar.label}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

interface ValueByCategoryProps {
  rows: readonly CategoryValueView[];
  currency: string;
  /** Whether some value is in other currencies, which this chart leaves out. */
  hasOtherCurrencies: boolean;
}

/** Estimated value per category as horizontal bars, in the default currency. */
export function ValueByCategoryChart({ rows, currency, hasOtherCurrencies }: ValueByCategoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Value by category</CardTitle>
        <CardDescription>
          In {currency}
          {hasOtherCurrencies && '; values in other currencies are not included'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add an estimated value to your items to see it here.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.category} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{formatMoney(row.total, currency)}</span>
                </div>
                <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', categoryClasses(row.category).solid)}
                    style={{ width: `${Math.max(row.ratio * 100, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
