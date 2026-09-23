import { describe, expect, it } from 'vitest';

import { getNavItems, isNavItemActive } from './nav-items';

describe('getNavItems', () => {
  it('hides the scanner in the browser', () => {
    const labels = getNavItems({ isDesktop: false }).map((item) => item.label);
    expect(labels).toEqual(['Dashboard', 'Collection', 'Search', 'Export', 'Settings']);
  });

  it('shows the scanner in the desktop app', () => {
    const labels = getNavItems({ isDesktop: true }).map((item) => item.label);
    expect(labels).toContain('Scanner');
  });
});

describe('isNavItemActive', () => {
  it('matches the page and its sub-pages only', () => {
    expect(isNavItemActive('/collection', '/collection')).toBe(true);
    expect(isNavItemActive('/collection', '/collection/tmdb/123')).toBe(true);
    expect(isNavItemActive('/collection', '/collections')).toBe(false);
    expect(isNavItemActive('/collection', '/dashboard')).toBe(false);
  });
});
