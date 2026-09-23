'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Metadata changes rarely; avoid refetching on every mount. Collection queries can lower this.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session (and per request during SSR), never shared between users.
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools buttonPosition="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
