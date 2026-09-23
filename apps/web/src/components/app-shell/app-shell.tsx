import Link from 'next/link';

import { APP_NAME } from '@fanste/core';

import { MobileNav } from './mobile-nav';
import { NavLinks } from './nav-links';
import { ThemeToggle } from './theme-toggle';

import type { ReactNode } from 'react';

/** Sidebar + topbar layout for the authenticated app pages. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-card p-4 md:flex">
        <Link href="/dashboard" className="px-3 text-lg font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <NavLinks />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <MobileNav />
          <Link href="/dashboard" className="font-semibold tracking-tight md:hidden">
            {APP_NAME}
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {/* The user menu (profile, sign-out) goes here in FC-06. */}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
