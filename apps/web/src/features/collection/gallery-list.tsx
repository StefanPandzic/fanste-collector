'use client';

import { cn } from 'cn';
import Link from 'next/link';

import { isOptimisticId } from '@fanste/collection';

import { CategoryBadge } from '@/components/items/category-badge';
import { CoverImage } from '@/components/items/cover-image';
import { OwnershipBadge } from '@/components/items/ownership-badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { formatDate, formatMoney } from './gallery-items';

import type { GalleryItem } from './gallery-items';
import type { Route } from 'next';

interface GalleryListProps {
  items: readonly GalleryItem[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  hrefOf: (id: string) => Route;
}

/** The gallery as a compact table: one row per copy (FC-18). */
export function GalleryList({ items, selected, onToggle, hrefOf }: GalleryListProps) {
  return (
    <Table aria-label="Your collection">
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <span className="sr-only">Select</span>
          </TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Cover</span>
          </TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="hidden sm:table-cell">Year</TableHead>
          <TableHead className="hidden md:table-cell">Copy</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Acquired</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <TableRow key={item.id} data-state={isSelected ? 'selected' : undefined}>
              <TableCell>
                {!isOptimisticId(item.id) && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(item.id)}
                    aria-label={`Select ${item.card.title}`}
                  />
                )}
              </TableCell>
              <TableCell className="py-1">
                <CoverImage
                  src={item.card.thumbnailUrl ?? item.card.imageUrl}
                  alt=""
                  category={item.card.category}
                  sizes="40px"
                  unoptimized={item.card.coverUnoptimized}
                  className="w-8 rounded-sm"
                />
              </TableCell>
              <TableCell className="max-w-64 whitespace-normal">
                <div className="flex min-w-0 items-center gap-2">
                  <CategoryBadge category={item.card.category} iconOnly className="shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <Link
                      href={hrefOf(item.id)}
                      className="truncate font-medium outline-none hover:underline focus-visible:underline"
                    >
                      {item.card.title}
                    </Link>
                    {item.subtitle && (
                      <span className="truncate text-caption text-muted-foreground">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                {item.card.releaseYear}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <CopyBadges labels={item.card.badges} />
              </TableCell>
              <TableCell>
                {item.card.ownership && <OwnershipBadge status={item.card.ownership} />}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {item.acquiredAt && formatDate(item.acquiredAt)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums lg:table-cell">
                {item.estimatedValue !== null && formatMoney(item.estimatedValue, item.currency)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CopyBadges({ labels, className }: { labels: readonly string[]; className?: string }) {
  if (labels.length === 0) return null;
  return (
    <ul aria-label="Copy details" className={cn('flex flex-wrap gap-1', className)}>
      {labels.map((label, index) => (
        <li
          key={`${index}-${label}`}
          className="rounded-sm bg-muted px-1 text-caption text-muted-foreground"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}
