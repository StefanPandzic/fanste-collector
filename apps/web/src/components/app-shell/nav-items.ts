import {
  FileDown,
  LayoutDashboard,
  Library,
  ScanLine,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react';

import type { Route } from 'next';

export interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** Only shown in the desktop app (Electron), e.g. features that need local file access. */
  desktopOnly?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/collection', label: 'Collection', icon: Library },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/scanner', label: 'Scanner', icon: ScanLine, desktopOnly: true },
  { href: '/export', label: 'Export', icon: FileDown },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/** Nav items available on the current platform. */
export function getNavItems({ isDesktop }: { isDesktop: boolean }): NavItem[] {
  return NAV_ITEMS.filter((item) => isDesktop || !item.desktopOnly);
}

/** Whether `pathname` is `href` or one of its sub-pages. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
