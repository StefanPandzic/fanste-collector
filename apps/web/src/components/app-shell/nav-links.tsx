'use client';

import { cn } from 'cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useIsDesktop } from '@/lib/platform';

import { getNavItems, isNavItemActive } from './nav-items';

/** Sidebar navigation. */
export function NavLinks() {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {getNavItems({ isDesktop }).map(({ href, label, icon: Icon }) => {
        const active = isNavItemActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none',
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              active && 'bg-muted text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
