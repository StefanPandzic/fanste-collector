'use client';

import { LoaderCircle, Pause, Play } from 'lucide-react';
import { useId } from 'react';

import { useSaveScannerSettings, useScannerSettings } from '@fanste/collection';
import { DEFAULT_SCANNER_SETTINGS } from '@fanste/core';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import type { ScanMatcher } from '@fanste/collection';

/** Progress of the background matching (FC-23), with Pause / Resume. Hidden while it's idle. */
export function MatchProgressPanel({ matcher }: { matcher: ScanMatcher }) {
  const { status, done, total, added, review } = matcher.progress;
  if (status === 'idle') return null;
  const paused = status === 'paused';

  return (
    <Card className="flex-row items-center gap-4 p-card" role="status" aria-live="polite">
      {paused ? (
        <Pause aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      ) : (
        <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin text-muted-foreground" />
      )}
      <p className="min-w-0 flex-1 text-sm font-medium">
        {paused ? 'Matching paused' : 'Matching with TMDB…'}{' '}
        <span className="text-muted-foreground tabular-nums">
          {done.toLocaleString()} of {total.toLocaleString()} · {added.toLocaleString()} added ·{' '}
          {review.toLocaleString()} to review
        </span>
      </p>
      <Button variant="outline" onClick={paused ? matcher.resume : matcher.pause}>
        {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
        {paused ? 'Resume' : 'Pause'}
      </Button>
    </Card>
  );
}

/**
 * The "Auto-add confident matches" setting (FC-23), saved to the user's profile. Off sends every
 * match to review.
 */
export function AutoAddSetting() {
  const id = useId();
  const settings = useScannerSettings();
  const save = useSaveScannerSettings();
  const autoAdd = settings.data?.autoAdd ?? DEFAULT_SCANNER_SETTINGS.autoAdd;

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={autoAdd}
        disabled={settings.isPending}
        onCheckedChange={(checked) => save.mutate({ ...settings.data, autoAdd: checked === true })}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>Auto-add confident matches</Label>
        <p className="text-sm text-muted-foreground">
          Files that clearly match a TMDB title are added to your collection. When off, every match
          waits for your review.
        </p>
      </div>
    </div>
  );
}
