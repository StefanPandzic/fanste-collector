'use client';

import { Menu, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useCustomCollections } from '@fanste/collection';
import { MAX_CUSTOM_COLLECTIONS } from '@fanste/core';

import { CollectionIcon } from '@/components/items/collection-icon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CollectionDialog } from '@/features/custom-collections/collection-dialog';
import { collectionHref } from '@/features/custom-collections/collection-view';
import { useScannerReviewCount } from '@/features/scanner/scan-matcher-provider';
import { useIsDesktop } from '@/lib/platform';

import { getNavItems, isNavItemActive } from './nav-items';
import { ReviewBadge } from './review-badge';

/** Navigation for narrow windows, where the sidebar is hidden. */
export function MobileNav() {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const reviewCount = useScannerReviewCount();
  const router = useRouter();
  const collections = useCustomCollections().data ?? [];
  const [creating, setCreating] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {getNavItems({ isDesktop }).map(({ href, label, icon: Icon, reviewBadge }) => (
            <DropdownMenuItem key={href} asChild>
              <Link href={href} aria-current={isNavItemActive(href, pathname) ? 'page' : undefined}>
                <Icon aria-hidden />
                {label}
                {reviewBadge && <ReviewBadge count={reviewCount} className="ml-auto" />}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-caption text-muted-foreground">
            My collections
          </DropdownMenuLabel>
          {collections.map((collection) => {
            const href = collectionHref(collection.id);
            return (
              <DropdownMenuItem key={collection.id} asChild>
                <Link
                  href={href}
                  aria-current={isNavItemActive(href, pathname) ? 'page' : undefined}
                >
                  <CollectionIcon icon={collection.icon} />
                  <span className="truncate">{collection.name}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem
            disabled={collections.length >= MAX_CUSTOM_COLLECTIONS}
            onSelect={() => setCreating(true)}
          >
            <Plus aria-hidden />
            New collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CollectionDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => router.push(collectionHref(created.id))}
      />
    </>
  );
}
