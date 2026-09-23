import { Geist, Geist_Mono } from 'next/font/google';

import { APP_NAME } from '@fanste/core';

import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

// Exposed to the shared Tailwind theme via --font-sans-app / --font-mono-app.
const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans-app' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono-app' });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description:
    'Track your movies, TV, music, video games, board games and Funko Pops in one place.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the theme class on <html> before hydration.
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
