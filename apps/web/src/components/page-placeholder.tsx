import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { ReactNode } from 'react';

interface PagePlaceholderProps {
  title: string;
  description: string;
  /** Task that implements the page, e.g. `FC-20`. */
  task: string;
  children?: ReactNode;
}

/** Stand-in for pages that later tasks implement. */
export function PagePlaceholder({ title, description, task, children }: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>This page is implemented in {task}.</CardDescription>
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
    </div>
  );
}
