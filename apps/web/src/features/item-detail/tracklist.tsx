'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { MusicTrack } from '@fanste/core';

/** Tracks shown before "Show all". */
const COLLAPSED_TRACKS = 12;

/** A record's tracklist (FC-10): position, title and duration, long lists collapsed. */
export function Tracklist({
  tracks,
  heading: Heading = 'h2',
}: {
  tracks: readonly MusicTrack[];
  /** The heading's level where the list is shown (`h4` under the add dialog's `h3`). */
  heading?: 'h2' | 'h4';
}) {
  const [expanded, setExpanded] = useState(false);
  if (tracks.length === 0) return null;
  const visible = expanded ? tracks : tracks.slice(0, COLLAPSED_TRACKS);

  return (
    <section className="flex max-w-prose flex-col gap-2" aria-labelledby="item-tracklist">
      <Heading id="item-tracklist" className="text-sm font-medium">
        Tracklist
      </Heading>
      <ol className="flex flex-col text-sm">
        {visible.map((track, index) => (
          <li
            key={`${index}-${track.position ?? ''}`}
            className="grid grid-cols-[2.5rem_1fr_auto] gap-2 border-b py-1 last:border-b-0"
          >
            <span className="text-muted-foreground tabular-nums">{track.position}</span>
            <span className="min-w-0 break-words">{track.title}</span>
            <span className="text-muted-foreground tabular-nums">{track.duration}</span>
          </li>
        ))}
      </ol>
      {tracks.length > visible.length && (
        <Button
          variant="link"
          size="xs"
          className="self-start px-0"
          onClick={() => setExpanded(true)}
        >
          Show all {tracks.length} tracks
        </Button>
      )}
    </section>
  );
}
