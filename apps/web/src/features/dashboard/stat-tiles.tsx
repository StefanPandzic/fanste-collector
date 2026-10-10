import { Heart, Library, Wallet, type LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { formatMoney } from '@/features/collection/gallery-items';

import type { ValueSummary } from './dashboard-view';
import type { CollectionStats } from '@fanste/collection';
import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: ReactNode;
}

function StatTile({ label, value, icon: Icon, hint }: StatTileProps) {
  return (
    <Card className="gap-1 p-card">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon aria-hidden className="size-4" />
      </div>
      <p className="text-title tabular-nums">{value}</p>
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
    </Card>
  );
}

interface StatTilesProps {
  stats: CollectionStats;
  value: ValueSummary;
}

/** Total items, wishlist count and estimated value. */
export function StatTiles({ stats, value }: StatTilesProps) {
  const { items, quantity } = stats.inCollection;
  const wishlist = stats.byOwnership.wishlist.items;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatTile
        label="Items"
        icon={Library}
        value={items.toLocaleString()}
        hint={quantity > items ? `${quantity.toLocaleString()} units` : 'Owned, preordered or lent'}
      />
      <StatTile label="Wishlist" icon={Heart} value={wishlist.toLocaleString()} />
      <StatTile
        label="Estimated value"
        icon={Wallet}
        value={formatMoney(value.main.total, value.main.currency)}
        hint={
          value.others.length > 0
            ? `+ ${value.others.map((other) => formatMoney(other.total, other.currency)).join(', ')}`
            : undefined
        }
      />
    </div>
  );
}
