import { cn } from 'cn';
import Link from 'next/link';

import { CategoryIcon } from '@/components/items/category-icon';
import { categoryClasses } from '@/components/items/category-style';

import type { CategoryCardView } from './dashboard-view';

const CARD =
  'flex items-center gap-3 rounded-xl bg-card p-card text-card-foreground shadow-card transition-shadow';

/** A card per category with its item count; built categories link to the filtered gallery. */
export function CategoryCards({ cards }: { cards: readonly CategoryCardView[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const body = (
          <>
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                categoryClasses(card.category).soft,
              )}
            >
              <CategoryIcon category={card.category} className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{card.label}</span>
              <span className="text-caption text-muted-foreground">
                {card.available ? `${card.count.toLocaleString()} items` : 'Coming soon'}
              </span>
            </span>
          </>
        );
        return (
          <li key={card.category}>
            {card.available ? (
              <Link
                href={card.href}
                className={cn(
                  CARD,
                  'outline-none hover:shadow-card-hover focus-visible:ring-3 focus-visible:ring-ring/60',
                )}
              >
                {body}
              </Link>
            ) : (
              <div className={cn(CARD, 'opacity-60')}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
