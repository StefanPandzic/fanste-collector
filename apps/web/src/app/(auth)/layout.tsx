import { APP_NAME } from '@fanste/core';

import { ThemeToggle } from '@/components/app-shell/theme-toggle';

import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* The desktop window's title bar, like the app shell's top bar. */}
      <header className="flex h-14 items-center justify-between px-4 app-drag desktop-mac:pl-20 desktop-win:pr-window-controls">
        <span className="font-semibold tracking-tight">{APP_NAME}</span>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
