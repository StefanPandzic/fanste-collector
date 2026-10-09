'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useIsDesktop } from '@/lib/platform';
import { isSearchShortcut } from '@/lib/shortcuts';

/** `id` of the search page's query input, which the shortcut focuses. */
export const SEARCH_INPUT_ID = 'search-query';

/**
 * Desktop app only: Ctrl+K (Cmd+K on macOS) opens the search page from anywhere, or focuses its
 * input when it is already open. Renders nothing.
 */
export function SearchShortcut() {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const os = window.fanste?.platform.os;
    if (!isDesktop || !os) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isSearchShortcut(event, os)) return;
      event.preventDefault();
      const input = document.getElementById(SEARCH_INPUT_ID);
      if (pathname === '/search' && input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      } else {
        // The search page focuses its input when it opens.
        router.push('/search');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, pathname, router]);

  return null;
}
