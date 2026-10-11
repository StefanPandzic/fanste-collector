'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useScannerReviewCount } from '@/features/scanner/scan-matcher-provider';
import { useIsDesktop } from '@/lib/platform';

import { getNavItems, isNavItemActive } from './nav-items';
import { ReviewBadge } from './review-badge';

/** Navigation for narrow windows, where the sidebar is hidden. */
export function MobileNav() {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const reviewCount = useScannerReviewCount();

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
